import { cn } from "@/lib/utils"
import type { IncidentStatus, Severity } from "@/lib/incidents"

const statusConfig: Record<
  IncidentStatus,
  { label: string; dot: string; text: string; bg: string; ring: string }
> = {
  triggered: {
    label: "Triggered",
    dot: "bg-triggered",
    text: "text-triggered",
    bg: "bg-triggered/10",
    ring: "ring-triggered/30",
  },
  acknowledged: {
    label: "Acknowledged",
    dot: "bg-acknowledged",
    text: "text-acknowledged",
    bg: "bg-acknowledged/10",
    ring: "ring-acknowledged/30",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-resolved",
    text: "text-resolved-foreground/70",
    bg: "bg-resolved/15",
    ring: "ring-resolved/30",
  },
}

export function StatusDot({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status]
  return (
    <span className="relative flex size-2.5 shrink-0 items-center justify-center">
      {status === "triggered" && (
        <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-triggered/60" />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", c.dot)} />
    </span>
  )
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.bg,
        c.text,
        c.ring,
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  )
}

const severityConfig: Record<Severity, string> = {
  SEV1: "bg-triggered/15 text-triggered ring-triggered/30",
  SEV2: "bg-acknowledged/15 text-acknowledged ring-acknowledged/30",
  SEV3: "bg-muted text-muted-foreground ring-border",
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ring-1 ring-inset",
        severityConfig[severity],
      )}
    >
      {severity}
    </span>
  )
}
