type Stat = {
  label: string
  value: string
  hint?: string
  tone?: "triggered" | "acknowledged" | "default"
}

function valueClass(tone: Stat["tone"]) {
  if (tone === "triggered") return "text-triggered"
  if (tone === "acknowledged") return "text-acknowledged"
  return "text-foreground"
}

export function StatsStrip({
  open,
  acknowledged,
  mtta,
}: {
  open: number
  acknowledged: number
  mtta: string
}) {
  const stats: Stat[] = [
    { label: "Open incidents", value: String(open), tone: "triggered" },
    { label: "Acknowledged", value: String(acknowledged), tone: "acknowledged" },
    {
      label: "Mean time to acknowledge",
      value: mtta,
      hint: "last 24h",
      tone: "default",
    },
  ]

  return (
    <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background">
      {stats.map((stat) => (
        <div key={stat.label} className="px-4 py-3 md:px-6">
          <p className="text-xs font-medium text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold tabular-nums tracking-tight ${valueClass(
                stat.tone,
              )}`}
            >
              {stat.value}
            </span>
            {stat.hint && (
              <span className="text-xs text-muted-foreground/70">
                {stat.hint}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
