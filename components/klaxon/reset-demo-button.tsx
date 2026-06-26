"use client"

import { useState } from "react"
import { RotateCcw, Check } from "lucide-react"

export function ResetDemoButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const run = async () => {
    if (
      !window.confirm(
        "Replace ALL incidents with the curated demo template? This deletes current incidents.",
      )
    )
      return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/demo/reset", { method: "POST" })
      const d = await r.json()
      setMsg(d.ok ? `Reset to ${d.count} example incidents.` : `Error: ${d.error}`)
    } catch {
      setMsg("Request failed")
    }
    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Demo data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Replace all incidents with a curated example set (triggered,
            acknowledged, resolved across several services).
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-60"
        >
          <RotateCcw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Resetting…" : "Reset to template"}
        </button>
      </div>
      {msg && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-acknowledged">
          <Check className="size-3.5" />
          {msg}
        </p>
      )}
    </div>
  )
}
