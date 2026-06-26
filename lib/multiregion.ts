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
