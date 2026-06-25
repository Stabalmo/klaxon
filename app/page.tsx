import { Sidebar } from "@/components/klaxon/sidebar"
import { IncidentsView } from "@/components/klaxon/incidents-view"
import { TelegramSimulator } from "@/components/klaxon/telegram-simulator"

export default function Page() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <IncidentsView />
      <TelegramSimulator />
    </div>
  )
}
