import { ArrowRight, Clock } from "lucide-react"
import type { ServiceSchedule } from "@/lib/schedules"
import { ResponderAvatar } from "./responder-avatar"
import { RotationStrip } from "./rotation-strip"

export function OnCallCard({ schedule }: { schedule: ServiceSchedule }) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-5">
      {/* Service name */}
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-resolved" />
        <h2 className="font-mono text-sm font-medium text-foreground">
          {schedule.service}
        </h2>
      </div>

      {/* Current on-call responder */}
      <div className="flex items-center gap-3">
        <ResponderAvatar
          initials={schedule.current.initials}
          tone={schedule.current.tone}
          className="size-11 text-sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {schedule.current.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            on call until {schedule.onCallUntil}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-resolved/15 px-2 py-1 text-[11px] font-medium text-resolved-foreground/80 ring-1 ring-inset ring-resolved/30">
          <span className="size-1.5 rounded-full bg-resolved" />
          On call
        </span>
      </div>

      {/* Up next */}
      <div className="mt-4 flex items-center gap-2.5 rounded-md bg-muted/50 px-3 py-2.5">
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        <ResponderAvatar
          initials={schedule.next.initials}
          tone={schedule.next.tone}
          className="size-6 text-[10px]"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {schedule.next.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Up next · {schedule.nextStarts}
          </p>
        </div>
      </div>

      {/* Weekly rotation */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          This week
        </p>
        <RotationStrip rotation={schedule.rotation} />
      </div>
    </article>
  )
}
