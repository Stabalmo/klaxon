// lib/multiregion.ts
// Cross-region strong-consistency demo on the peered Aurora DSQL clusters:
// write through one regional endpoint, read it back immediately through the
// other. A successful read with zero replication lag proves active-active
// strong consistency.

import { queryOn } from "./db"

export type RegionNode = { host: string; region: string; label: string }

// Endpoints come from env; sensible defaults point at the provisioned
// multi-region cluster (endpoints are not secrets).
export const PRIMARY: RegionNode = {
  host:
    process.env.DSQL_PRIMARY_HOST ||
    "4zt4b6ref4kqrlpku2xvp74ire.dsql.eu-central-1.on.aws",
  region: "eu-central-1",
  label: "Frankfurt",
}

export const SECONDARY: RegionNode = {
  host:
    process.env.DSQL_SECONDARY_HOST ||
    "2vt4b6hdq6ybyhbxuwkss6sjfa.dsql.eu-west-1.on.aws",
  region: "eu-west-1",
  label: "Ireland",
}

const PROBE_DDL = `CREATE TABLE IF NOT EXISTS consistency_probe (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token          TEXT NOT NULL,
  written_region TEXT NOT NULL,
  written_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)`

/** Idempotently ensure the probe table exists (single logical DB). */
export async function ensureProbeTable() {
  try {
    await queryOn(PRIMARY.host, PROBE_DDL)
  } catch {
    // already exists / concurrent create — fine
  }
}

export type ConsistencyResult = {
  token: string
  wrote: { region: string; label: string; ms: number }
  read: { region: string; label: string; ms: number; found: boolean }
  consistent: boolean
  totalMs: number
}

/**
 * Write a unique token via PRIMARY, read it back via SECONDARY immediately.
 * `consistent: true` means the cross-region read saw the write with no lag.
 */
export async function runConsistencyTest(): Promise<ConsistencyResult> {
  const token = `probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  const w0 = Date.now()
  await queryOn(
    PRIMARY.host,
    `INSERT INTO consistency_probe (token, written_region) VALUES ($1, $2)`,
    [token, PRIMARY.region],
  )
  const writeMs = Date.now() - w0

  const r0 = Date.now()
  const res = await queryOn<{ token: string }>(
    SECONDARY.host,
    `SELECT token FROM consistency_probe WHERE token = $1`,
    [token],
  )
  const readMs = Date.now() - r0
  const found = res.rows.length > 0

  return {
    token,
    wrote: { region: PRIMARY.region, label: PRIMARY.label, ms: writeMs },
    read: { region: SECONDARY.region, label: SECONDARY.label, ms: readMs, found },
    consistent: found,
    totalMs: writeMs + readMs,
  }
}

/* ------------------------------------------------------------------ */
/* Region failover demo — take a region "offline", keep serving        */
/* ------------------------------------------------------------------ */

const NODES: RegionNode[] = [PRIMARY, SECONDARY]

const STATE_DDL = `CREATE TABLE IF NOT EXISTS demo_region_state (
  region   TEXT PRIMARY KEY,
  disabled BOOLEAN NOT NULL DEFAULT false
)`

/** Run an op against whichever regional endpoint answers first (read path). */
async function withAnyRegion<T>(fn: (n: RegionNode) => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (const n of NODES) {
    try {
      return await fn(n)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

async function ensureTables() {
  await withAnyRegion((n) => queryOn(n.host, STATE_DDL)).catch(() => {})
  await ensureProbeTable()
}

// Create the demo tables at most once per warm instance.
let tablesEnsured = false
async function ensureOnce() {
  if (tablesEnsured) return
  await ensureTables()
  tablesEnsured = true
}

export type RegionHealth = {
  region: string
  label: string
  disabled: boolean
}

export type ServiceStatus = {
  regions: RegionHealth[]
  operational: boolean
  serving: { region: string; label: string } | null
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  // Fast path: a single read, no DDL. If the table isn't created yet,
  // treat every region as healthy.
  let rows: { region: string; disabled: boolean }[] = []
  try {
    const r = await withAnyRegion((n) =>
      queryOn<{ region: string; disabled: boolean }>(
        n.host,
        `SELECT region, disabled FROM demo_region_state`,
      ),
    )
    rows = r.rows
  } catch {
    /* table not created yet — all healthy */
  }
  const disabled = new Map(rows.map((r) => [r.region, r.disabled]))
  const regions: RegionHealth[] = NODES.map((n) => ({
    region: n.region,
    label: n.label,
    disabled: !!disabled.get(n.region),
  }))
  const serving = NODES.find((n) => !disabled.get(n.region)) ?? null
  return {
    regions,
    operational: !!serving,
    serving: serving ? { region: serving.region, label: serving.label } : null,
  }
}

/** Toggle a simulated regional outage (update-or-insert, DSQL-safe). */
export async function setRegionDisabled(region: string, disabled: boolean) {
  await ensureOnce()
  await withAnyRegion(async (n) => {
    const upd = await queryOn(
      n.host,
      `UPDATE demo_region_state SET disabled = $2 WHERE region = $1`,
      [region, disabled],
    )
    if (upd.rowCount === 0) {
      await queryOn(
        n.host,
        `INSERT INTO demo_region_state (region, disabled) VALUES ($1, $2)`,
        [region, disabled],
      )
    }
  })
  return getServiceStatus()
}

/**
 * One live write+read through the currently-serving region. Used by the demo
 * heartbeat to show the service keeps working even with a region "offline".
 */
export async function heartbeat() {
  await ensureOnce()
  const status = await getServiceStatus()
  if (!status.serving) {
    return { ok: false, reason: "all regions offline" as const }
  }
  const node = NODES.find((n) => n.region === status.serving!.region)!
  const token = `hb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const t0 = Date.now()
  try {
    await queryOn(
      node.host,
      `INSERT INTO consistency_probe (token, written_region) VALUES ($1, $2)`,
      [token, node.region],
    )
    const res = await queryOn<{ token: string }>(
      node.host,
      `SELECT token FROM consistency_probe WHERE token = $1`,
      [token],
    )
    return {
      ok: res.rows.length > 0,
      servedBy: { region: node.region, label: node.label },
      ms: Date.now() - t0,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, servedBy: { region: node.region, label: node.label }, error: message }
  }
}
