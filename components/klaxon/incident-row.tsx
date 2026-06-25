import Link from "next/link"
import { Check, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type Incident, formatCountdown } from "@/lib/incidents"
import { StatusDot, StatusBadge, SeverityBadge } from "./badges"
import { ResponderAvatar } from "./responder-avatar"

export function IncidentRow({
  incident,
  onAcknowledge,
  onResolve,
}: {
  incident: Incident
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
}) {
  const isResolved = incident.status === "resolved"

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-card/60 md:gap-x-5 md:px-6",
        isResolved && "opacity-65",
      )}
    >
      {/* Stretched link makes the whole row navigate to the detail page */}
      <Link
        href={`/incidents/${incident.id}`}
        className="absolute inset-0 z-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label={`View incident ${incident.id}: ${incident.title}`}
      />

      {/* Status + severity cluster */}
      <div className="flex items-center gap-3">
        <StatusDot status={incident.status} />
        <SeverityBadge severity={incident.severity} />
      </div>

      {/* Main info */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3
            className={cn(
              "truncate text-sm font-medium text-foreground",
              isResolved && "line-through decoration-muted-foreground/40",
            )}
          >
            {incident.title}
          </h3>
          <span className="font-mono text-xs text-muted-foreground">
            {incident.service}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums text-muted-foreground/80">
            {incident.id}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1.5">
            <ResponderAvatar
              initials={incident.responder.initials}
              tone={incident.responder.tone}
              className="size-5 text-[9px]"
            />
            {incident.responder.name}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="tabular-nums">{incident.createdAt}</span>
        </div>
      </div>

      {/* Right rail: status-specific actions */}
      <div className="relative z-10 col-start-2 row-start-2 flex items-center justify-start gap-3 md:col-start-3 md:row-start-1 md:justify-end">
        <div className="md:hidden">
          <StatusBadge status={incident.status} />
        </div>

        {incident.status === "triggered" && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-triggered/10 px-2 py-1 font-mono text-xs font-medium tabular-nums text-triggered ring-1 ring-inset ring-triggered/25">
              <Timer className="size-3.5" />
              escalates in {formatCountdown(incident.escalatesInSeconds ?? 0)}
            </span>
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAcknowledge(incident.id)}
              >
                Acknowledge
              </Button>
              <Button size="sm" onClick={() => onResolve(incident.id)}>
                Resolve
              </Button>
            </div>
          </>
        )}

        {incident.status === "acknowledged" && (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-acknowledged">
              <span className="size-1.5 rounded-full bg-acknowledged" />
              Ack&apos;d by {incident.ackedBy}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => onResolve(incident.id)}
            >
              Resolve
            </Button>
          </>
        )}

        {incident.status === "resolved" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-resolved-foreground/70">
            <Check className="size-3.5" />
            {incident.resolvedNote ?? "Resolved"}
          </span>
        )}
      </div>
    </div>
  )
}
