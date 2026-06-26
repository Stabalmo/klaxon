"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Region = { region: string; label: string; disabled: boolean }
type Status = { regions: Region[]; operational: boolean }

const FLAG: Record<string, string> = { "eu-central-1": "🇩🇪", "eu-west-1": "🇮🇪" }

export function ClusterStatus() {
  const [status, setStatus] = useState<Status | null>(null)

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
    // instant update when a failover is toggled in the same tab
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.regions) setStatus(d)
    }
    window.addEventListener("klaxon:region-status", onStatus)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener("klaxon:region-status", onStatus)
    }
  }, [])

  const anyDown = status?.regions.some((r) => r.disabled)

  return (
    <Link
      href="/multiregion"
      className="block rounded-lg border border-sidebar-border bg-card/40 p-2.5 transition-colors hover:bg-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Aurora DSQL
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
            !status
              ? "text-muted-foreground/60"
              : status.operational
                ? anyDown
                  ? "text-acknowledged"
                  : "text-acknowledged"
                : "text-triggered"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              !status
                ? "bg-muted-foreground/40"
                : status.operational
                  ? "animate-pulse bg-acknowledged"
                  : "bg-triggered"
            }`}
          />
          {!status ? "…" : anyDown ? "FAILOVER" : "ACTIVE-ACTIVE"}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {(status?.regions ?? [
          { region: "eu-central-1", label: "Frankfurt", disabled: false },
          { region: "eu-west-1", label: "Ireland", disabled: false },
        ]).map((r) => (
          <div key={r.region} className="flex items-center gap-2 text-xs">
            <span className="text-[13px] leading-none">{FLAG[r.region]}</span>
            <span className="text-foreground/90">{r.label}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {/* signal bars — green when healthy, dim when offline */}
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{ height: 4 + i * 3 }}
                  className={`w-1 rounded-sm ${
                    r.disabled ? "bg-triggered/40" : "bg-acknowledged"
                  } ${!r.disabled && i === 2 ? "animate-pulse" : ""}`}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </Link>
  )
}
