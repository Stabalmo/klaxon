"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Timer, Send, Mail } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  formatCountdown,
  relativeTime,
  type Incident,
  type TimelineEvent,
  type ApiNotification,
} from "@/lib/incidents"
import { StatusBadge, SeverityBadge } from "./badges"
import { ResponderAvatar } from "./responder-avatar"
import { IncidentTimeline } from "./incident-timeline"

function deliveryTone(status: string) {
  if (status === "sent") return "text-acknowledged"
  if (status === "failed") return "text-triggered"
  return "text-muted-foreground" // skipped / queued
}

export function IncidentDetailView({
  incident,
  timeline,
  notifications,
}: {
  incident: Incident
  timeline: TimelineEvent[]
  notifications: ApiNotification[]
}) {
  const router = useRouter()
  const [current, setCurrent] = useState<Incident>(incident)
  const [pending, setPending] = useState(false)

  // Reconcile with fresh server data after router.refresh().
  useEffect(() => {
    setCurrent(incident)
  }, [incident])

  // Live escalation countdown while still triggered.
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

  // Poll the server so a cron escalation or an ack from Telegram shows up live.
  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(poll)
  }, [router])

  // Drive escalation from the open page when the timer is due (no per-minute
  // cron on Hobby). Idempotent + OCC-safe, so extra calls are harmless.
  const escalatingRef = useRef(false)
  useEffect(() => {
    if (current.status !== "triggered") return
    if ((current.escalatesInSeconds ?? 1) > 0 || escalatingRef.current) return
    escalatingRef.current = true
    fetch("/api/cron/escalate", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        router.refresh()
        setTimeout(() => {
          escalatingRef.current = false
        }, 3000)
      })
  }, [current.status, current.escalatesInSeconds, router])

  const act = async (action: "ack" | "resolve") => {
    if (!current.dbId || pending) return
    setPending(true)
    // Optimistic flip; server reconciles on refresh.
    setCurrent((prev) =>
      action === "ack"
        ? { ...prev, status: "acknowledged", escalatesInSeconds: undefined }
        : { ...prev, status: "resolved", escalatesInSeconds: undefined },
    )
    try {
      await fetch(`/api/incidents/${current.dbId}/${action}`, { method: "POST" })
    } catch {
      /* refresh will resync */
    }
    router.refresh()
    setPending(false)
  }

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
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => act("ack")}
              >
                Acknowledge
              </Button>
            )}
            {current.status !== "resolved" && (
              <Button disabled={pending} onClick={() => act("resolve")}>
                Resolve
              </Button>
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

        {/* Delivery — where the page was sent */}
        {notifications.length > 0 && (
          <section className="border-b border-border py-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delivery
            </h2>
            <ul className="flex flex-col gap-2.5">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-center gap-2.5 text-sm">
                  {n.channel === "telegram" ? (
                    <Send className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium capitalize text-foreground">
                    {n.channel}
                  </span>
                  <span className="text-muted-foreground">
                    → {n.target_name ?? "—"}
                  </span>
                  <span
                    className={`text-xs font-medium ${deliveryTone(n.status)}`}
                  >
                    {n.status}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground/70">
                    {relativeTime(n.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
