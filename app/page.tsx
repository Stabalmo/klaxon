import { Sidebar } from "@/components/klaxon/sidebar"
import { IncidentsView } from "@/components/klaxon/incidents-view"

export default function Page() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <IncidentsView />
    </div>
  )
}
