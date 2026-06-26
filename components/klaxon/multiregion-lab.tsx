"use client"

import { useState } from "react"
import { ArrowRight, Check, X, Database, Loader2 } from "lucide-react"

type Result = {
  ok: boolean
  token?: string
  wrote?: { region: string; label: string; ms: number }
  read?: { region: string; label: string; ms: number; found: boolean }
  consistent?: boolean
  totalMs?: number
  error?: string
  at: number
}

const PRIMARY = { label: "Frankfurt", region: "eu-central-1", flag: "🇩🇪" }
const SECONDARY = { label: "Ireland", region: "eu-west-1", flag: "🇮🇪" }

function RegionCard({
  flag,
  label,
  region,
  role,
  active,
}: {
  flag: string
  label: string
  region: string
  role: string
  active: boolean
}) {
  return (
    <div
      className={`flex-1 rounded-lg border p-4 transition-colors ${
        active ? "border-acknowledged/50 bg-acknowledged/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{flag}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{region}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {role}
      </p>
    </div>
  )
}

export function MultiRegionLab() {
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<Result[]>([])

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch("/api/multiregion/test", { method: "POST" })
      const data = await res.json()
      setHistory((prev) => [{ ...data, at: Date.now() }, ...prev].slice(0, 8))
    } catch {
      setHistory((prev) =>
        [{ ok: false, error: "request failed", at: Date.now() }, ...prev].slice(0, 8),
      )
    }
    setRunning(false)
  }

  const latest = history[0]
  const total = history.length
  const consistent = history.filter((h) => h.consistent).length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6 md:py-8">
      <h2 className="text-balance text-lg font-semibold tracking-tight text-foreground">
        Cross-region strong consistency
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Two peered Aurora DSQL clusters, one logical database. We write a unique
        token through the Frankfurt endpoint and read it straight back through
        Ireland. A successful read with no lag proves active-active strong
        consistency.
      </p>

      {/* region flow */}
      <div className="mt-5 flex items-center gap-3">
        <RegionCard
          {...PRIMARY}
          role="write"
          active={running || !!latest?.consistent}
        />
        <div className="flex shrink-0 flex-col items-center gap-1 text-muted-foreground">
          <Database className="size-4" />
          <ArrowRight className="size-4" />
        </div>
        <RegionCard
          {...SECONDARY}
          role="read"
          active={running || !!latest?.consistent}
        />
      </div>

      <button
        onClick={run}
        disabled={running}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {running ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Writing in Frankfurt, reading in Ireland…
          </>
        ) : (
          "Run consistency test"
        )}
      </button>

      {/* latest result */}
      {latest && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            latest.consistent
              ? "border-acknowledged/40 bg-acknowledged/5"
              : "border-triggered/40 bg-triggered/5"
          }`}
        >
          {latest.ok ? (
            <>
              <div className="flex items-center gap-2">
                {latest.consistent ? (
                  <Check className="size-4 text-acknowledged" />
                ) : (
                  <X className="size-4 text-triggered" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {latest.consistent
                    ? "Strongly consistent — read-after-write across regions, no lag"
                    : "Not found in the read region"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Wrote · {latest.wrote?.label}</p>
                  <p className="mt-0.5 font-mono tabular-nums text-foreground">
                    {latest.wrote?.ms}ms
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Read · {latest.read?.label}</p>
                  <p className="mt-0.5 font-mono tabular-nums text-foreground">
                    {latest.read?.ms}ms
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="mt-0.5 font-mono tabular-nums text-foreground">
                    {latest.totalMs}ms
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground/70">
                token {latest.token}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <X className="size-4 text-triggered" />
              <span className="text-sm text-foreground">{latest.error}</span>
            </div>
          )}
        </div>
      )}

      {/* run history */}
      {total > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Runs
            </h3>
            <span className="text-xs font-medium text-acknowledged">
              {consistent}/{total} consistent
            </span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {history.map((h) => (
              <li
                key={h.at}
                className="flex items-center gap-3 px-3 py-2 text-xs"
              >
                {h.consistent ? (
                  <Check className="size-3.5 shrink-0 text-acknowledged" />
                ) : (
                  <X className="size-3.5 shrink-0 text-triggered" />
                )}
                <span className="font-mono text-muted-foreground/80">
                  {PRIMARY.region} → {SECONDARY.region}
                </span>
                <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                  {h.ok ? `${h.totalMs}ms` : "error"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
