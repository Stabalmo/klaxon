import { Sidebar } from "@/components/klaxon/sidebar"
import { OnCallCard } from "@/components/klaxon/on-call-card"
import { schedules } from "@/lib/schedules"

export const metadata = {
  title: "On-call now · Klaxon",
  description: "See who is currently on call across every service.",
}

export default function SchedulesPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Schedules
          </h1>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">On-call now</span>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h2 className="text-balance text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              On-call now
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Who&apos;s holding the pager across every service this week.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {schedules.map((schedule) => (
              <OnCallCard key={schedule.id} schedule={schedule} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
