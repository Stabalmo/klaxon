import { notFound } from "next/navigation"
import { Sidebar } from "@/components/klaxon/sidebar"
import { IncidentDetailView } from "@/components/klaxon/incident-detail-view"
import { getIncident, incidents } from "@/lib/incidents"

export function generateStaticParams() {
  return incidents.map((incident) => ({ id: incident.id }))
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const incident = getIncident(id)

  if (!incident) {
    notFound()
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <IncidentDetailView incident={incident} />
    </div>
  )
}
