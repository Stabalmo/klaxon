import { cn } from "@/lib/utils"

export function ResponderAvatar({
  initials,
  tone,
  className,
}: {
  initials: string
  tone: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tracking-tight text-background",
        className,
      )}
      style={{ backgroundColor: tone }}
    >
      {initials}
    </span>
  )
}
