"use client"

import { useEffect, useRef, useState } from "react"
import { Power, Check, ShieldCheck, AlertTriangle } from "lucide-react"

type Region = { region: string; label: string; disabled: boolean }
type Status = {
  regions: Region[]
  operational: boolean
  serving: { region: string; label: string } | null
}
type Beat = { ok: boolean; servedBy?: { region: string; label: string }; ms?: number; at: number }

const FLAG: Record<string, string> = { "eu-central-1": "🇩🇪", "eu-west-1": "🇮🇪" }

export function RegionFailover() {
  const [status, setStatus] = useState<Status | null>(null)
  const [beats, setBeats] = useState<Beat[]>([])
  const [toggling, setToggling] = useState<string | null>(null)

  // poll region health
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch("/api/multiregion/status", { cache: "no-store" })
        const d = await r.json()
        if (alive && d.ok) setStatus(d)
      } catch {
        /* ignore */
      }
    }
    load()
    const t = setInterval(load, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  // continuous service heartbeat (sequential, no overlap)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    const loop = async () => {
      while (aliveRef.current) {
        try {
          const r = await fetch("/api/multiregion/heartbeat", { method: "POST" })
          const d = await r.json()
          if (aliveRef.current)
            setBeats((p) => [{ ...d, at: Date.now() }, ...p].slice(0, 28))
        } catch {
          if (aliveRef.current)
            setBeats((p) => [{ ok: false, at: Date.now() }, ...p].slice(0, 28))
        }
        await new Promise((res) => setTimeout(res, 1200))
      }
    }
    loop()
    return () => {
      aliveRef.current = false
    }
  }, [])

  const toggle = async (region: string, disabled: boolean) => {
    setToggling(region)
    try {
      const r = await fetch("/api/multiregion/failover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, disabled }),
      })
      const d = await r.json()
      if (d.ok) {
        setStatus(d)
        // push the new status to the sidebar instantly (same tab)
        window.dispatchEvent(new CustomEvent("klaxon:region-status", { detail: d }))
      }
    } catch {
      /* ignore */
    }
    setToggling(null)
  }

  const anyDown = status?.regions.some((r) => r.disabled)
  const streak = (() => {
    let n = 0
    for (const b of beats) {
      if (b.ok) n++
      else break
    }
    return n
  })()

  return (
    <div className="border-t border-border px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="text-balance text-lg font-semibold tracking-tight text-foreground">
          Survives a region outage
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Take a region offline. The service keeps reading and writing through
          the surviving region — active-active, no failover downtime.
        </p>

        {/* service status banner */}
        <div
          className={`mt-5 flex items-center gap-3 rounded-lg border p-3.5 ${
            status?.operational
              ? "border-acknowledged/40 bg-acknowledged/5"
              : "border-triggered/40 bg-triggered/5"
          }`}
        >
          {status?.operational ? (
            <ShieldCheck className="size-5 shrink-0 text-acknowledged" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 text-triggered" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {status?.operational ? "Service operational" : "Service down"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status?.serving
                ? anyDown
                  ? `Failed over — serving from ${status.serving.label}`
                  : `Serving from ${status.serving.label}`
                : "all regions offline"}
            </p>
          </div>
          {streak > 0 && (
            <span className="ml-auto font-mono text-xs tabular-nums text-acknowledged">
              {streak} ✓ in a row
            </span>
          )}
        </div>

        {/* region controls */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {status?.regions.map((r) => (
            <div
              key={r.region}
              className={`rounded-lg border p-4 transition-colors ${
                r.disabled
                  ? "border-triggered/40 bg-triggered/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{FLAG[r.region]}</span>
                  <span className="text-sm font-medium text-foreground">
                    {r.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    r.disabled ? "text-triggered" : "text-acknowledged"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      r.disabled ? "bg-triggered" : "animate-pulse bg-acknowledged"
                    }`}
                  />
                  {r.disabled ? "Offline" : "Healthy"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {r.region}
              </p>
              <button
                onClick={() => toggle(r.region, !r.disabled)}
                disabled={toggling === r.region}
                className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  r.disabled
                    ? "bg-secondary text-foreground hover:bg-secondary/70"
                    : "bg-triggered/10 text-triggered ring-1 ring-inset ring-triggered/30 hover:bg-triggered/20"
                }`}
              >
                <Power className="size-3.5" />
                {r.disabled ? "Restore region" : "Simulate outage"}
              </button>
            </div>
          ))}
        </div>

        {/* live heartbeat */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live service heartbeat
            </h3>
            {beats[0]?.ok && beats[0]?.servedBy && (
              <span className="font-mono text-xs text-muted-foreground">
                served by {beats[0].servedBy.label} · {beats[0].ms}ms
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {beats.map((b) => (
              <span
                key={b.at}
                title={b.ok ? `${b.servedBy?.label} · ${b.ms}ms` : "failed"}
                className={`flex size-5 items-center justify-center rounded ${
                  b.ok ? "bg-acknowledged/15 text-acknowledged" : "bg-triggered/15 text-triggered"
                }`}
              >
                {b.ok ? <Check className="size-3" /> : "×"}
              </span>
            ))}
            {beats.length === 0 && (
              <span className="text-xs text-muted-foreground">starting…</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
