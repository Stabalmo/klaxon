"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Timer } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildTimeline,
  formatCountdown,
  type Incident,
} from "@/lib/incidents"
import { StatusBadge, SeverityBadge } from "./badges"
import { ResponderAvatar } from "./responder-avatar"
import { IncidentTimeline } from "./incident-timeline"

const ACTING_USER = "Maya Chen"

export function IncidentDetailView({ incident }: { incident: Incident }) {
  const [current, setCurrent] = useState<Incident>(incident)

  // Live escalation countdown while the incident is still triggered.
  useEffect(() => {
    if (current.status !== "triggered" || !current.escalatesInSeconds) return
    const interval = setInterval(() => {
      setCurrent((prev) =>
        prev.status === "triggered" && prev.escalatesInSeconds
          ? {
              ...prev,
              escalatesInSeconds: Math.max(0, prev.escalatesInSeconds - 1),
            }
          : prev,
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [current.status, current.escalatesInSeconds])

  const acknowledge = () =>
    setCurrent((prev) => ({
      ...prev,
      status: "acknowledged",
      ackedBy: ACTING_USER,
      escalatesInSeconds: undefined,
    }))

  const resolve = () =>
    setCurrent((prev) => ({
      ...prev,
      status: "resolved",
      ackedBy: prev.ackedBy ?? ACTING_USER,
      resolvedNote: "Resolved just now",
      escalatesInSeconds: undefined,
    }))

  const timeline = useMemo(() => buildTimeline(current), [current])

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
        <Link
          href="/"
          aria-label="Back to incidents"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-2 shrink-0",
          )}
        >
          <ArrowLeft />
        </Link>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {current.id}
        </span>
        <StatusBadge status={current.status} />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Incident header */}
        <div className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={current.severity} />
              <span className="font-mono text-xs text-muted-foreground">
                {current.service}
              </span>
            </div>
            <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {current.title}
            </h1>

            {current.status === "triggered" && current.escalatesInSeconds ? (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-triggered/10 px-2 py-1 font-mono text-xs font-medium tabular-nums text-triggered ring-1 ring-inset ring-triggered/25">
                <Timer className="size-3.5" />
                escalates in {formatCountdown(current.escalatesInSeconds)}
              </span>
            ) : null}
          </div>

          {/* Header actions */}
          <div className="flex shrink-0 items-center gap-2">
            {current.status === "triggered" && (
              <Button variant="outline" onClick={acknowledge}>
                Acknowledge
              </Button>
            )}
            {current.status !== "resolved" && (
              <Button onClick={resolve}>Resolve</Button>
            )}
            {current.status === "resolved" && (
              <span className="text-sm text-resolved-foreground/70">
                {current.resolvedNote ?? "Resolved"}
              </span>
            )}
          </div>
        </div>

        {/* Assigned responder */}
        <section className="border-b border-border py-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assigned responder
          </h2>
          <div className="flex items-center gap-3">
            <ResponderAvatar
              initials={current.responder.initials}
              tone={current.responder.tone}
              className="size-10 text-sm"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {current.responder.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Primary on-call · opened {current.createdAt}
              </p>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="pt-6">
          <h2 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Timeline
          </h2>
          <IncidentTimeline events={timeline} />
        </section>
      </main>
    </div>
  )
}
