import { weekdays, todayIndex, type Shift } from "@/lib/schedules"

export function RotationStrip({ rotation }: { rotation: Shift[] }) {
  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((day, i) => (
          <div
            key={day}
            className={
              "text-center text-[10px] font-medium uppercase tracking-wider " +
              (i === todayIndex ? "text-foreground" : "text-muted-foreground")
            }
          >
            {day}
          </div>
        ))}
      </div>

      {/* Shift blocks laid out over a 7-column grid */}
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {rotation.map((shift, i) => (
          <div
            key={i}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md px-1 ring-1 ring-inset ring-border/60"
            style={{
              gridColumn: `${shift.startDay + 1} / span ${shift.spanDays}`,
              backgroundColor: `color-mix(in oklab, ${shift.responder.tone} 22%, transparent)`,
            }}
            title={`${shift.responder.name} — ${shift.spanDays} day${
              shift.spanDays > 1 ? "s" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: shift.responder.tone }}
            />
            <span className="truncate text-[11px] font-medium text-foreground">
              {shift.responder.initials}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
