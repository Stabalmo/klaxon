"use client"

import { useEffect, useMemo, useState } from "react"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  incidents as seedIncidents,
  type Incident,
  type IncidentStatus,
} from "@/lib/incidents"
import { StatsStrip } from "./stats-strip"
import { IncidentRow } from "./incident-row"

type Filter = "all" | IncidentStatus

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "triggered", label: "Triggered" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
]

const statusRank: Record<IncidentStatus, number> = {
  triggered: 0,
  acknowledged: 1,
  resolved: 2,
}

let testAlertCount = 0

export function IncidentsView() {
  const [items, setItems] = useState<Incident[]>(seedIncidents)
  const [filter, setFilter] = useState<Filter>("all")

  // Live escalation countdown for triggered incidents.
  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) =>
        prev.map((inc) =>
          inc.status === "triggered" && inc.escalatesInSeconds
            ? {
                ...inc,
                escalatesInSeconds: Math.max(0, inc.escalatesInSeconds - 1),
              }
            : inc,
        ),
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const acknowledge = (id: string) =>
    setItems((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              status: "acknowledged",
              ackedBy: "Maya Chen",
              escalatesInSeconds: undefined,
            }
          : inc,
      ),
    )

  const resolve = (id: string) =>
    setItems((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              status: "resolved",
              resolvedNote: "Resolved just now",
              escalatesInSeconds: undefined,
            }
          : inc,
      ),
    )

  const sendTestAlert = () => {
    testAlertCount += 1
    const id = `INC-${2042 + testAlertCount}`
    const newIncident: Incident = {
      id,
      title: "Test alert — synthetic monitor failed",
      service: "synthetic-probe",
      severity: "SEV3",
      status: "triggered",
      responder: { name: "Maya Chen", initials: "MC", tone: "var(--chart-1)" },
      createdAt: "just now",
      escalatesInSeconds: 300,
    }
    setItems((prev) => [newIncident, ...prev])
  }

  const counts = useMemo(() => {
    const open = items.filter((i) => i.status === "triggered").length
    const acknowledged = items.filter(
      (i) => i.status === "acknowledged",
    ).length
    return { open, acknowledged }
  }, [items])

  const visible = useMemo(() => {
    const list =
      filter === "all" ? items : items.filter((i) => i.status === filter)
    return [...list].sort((a, b) => statusRank[a.status] - statusRank[b.status])
  }, [items, filter])

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Incidents
        </h1>

        <div className="flex items-center gap-3">
          <div
            role="tablist"
            aria-label="Filter incidents by status"
            className="hidden items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 sm:flex"
          >
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={sendTestAlert}>
            <Zap />
            Send test alert
          </Button>
        </div>
      </header>

      <StatsStrip
        open={counts.open}
        acknowledged={counts.acknowledged}
        mtta="3m 12s"
      />

      {/* Mobile filter */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-4 py-2 sm:hidden">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Incident list */}
      <main className="flex-1">
        <div className="divide-y divide-border">
          {visible.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onAcknowledge={acknowledge}
              onResolve={resolve}
            />
          ))}
        </div>

        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
            <p className="text-sm font-medium text-foreground">
              No {filter} incidents
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;re all caught up here.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
