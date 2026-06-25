import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TimelineEvent, TimelineEventKind } from "@/lib/incidents"

const kindConfig: Record<
  TimelineEventKind,
  { icon: LucideIcon; ring: string; bg: string; text: string }
> = {
  triggered: {
    icon: AlertTriangle,
    ring: "ring-triggered/30",
    bg: "bg-triggered/10",
    text: "text-triggered",
  },
  notified: {
    icon: BellRing,
    ring: "ring-border",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  escalated: {
    icon: ArrowUpRight,
    ring: "ring-acknowledged/30",
    bg: "bg-acknowledged/10",
    text: "text-acknowledged",
  },
  acknowledged: {
    icon: Check,
    ring: "ring-acknowledged/30",
    bg: "bg-acknowledged/10",
    text: "text-acknowledged",
  },
  resolved: {
    icon: CheckCircle2,
    ring: "ring-resolved/40",
    bg: "bg-resolved/20",
    text: "text-resolved-foreground",
  },
}

export function IncidentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative ml-1.5">
      {events.map((event, index) => {
        const c = kindConfig[event.kind]
        const Icon = c.icon
        const isLast = index === events.length - 1
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
              />
            )}

            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                c.bg,
                c.ring,
              )}
            >
              <Icon className={cn("size-4", c.text)} />
            </span>

            <div className="min-w-0 pt-1">
              <p className="text-sm font-medium text-foreground">
                {event.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>{event.actor}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular-nums">{event.time}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
