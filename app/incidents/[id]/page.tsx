import { notFound } from "next/navigation"
import { Sidebar } from "@/components/klaxon/sidebar"
import { IncidentDetailView } from "@/components/klaxon/incident-detail-view"
import { getIncidentDetail } from "@/lib/db"
import {
  incidentFromApi,
  timelineFromEvents,
  type ApiIncident,
  type ApiEvent,
  type ApiNotification,
} from "@/lib/incidents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getIncidentDetail(id)

  if (!detail) {
    notFound()
  }

  const incident = incidentFromApi(detail.incident as ApiIncident)
  const timeline = timelineFromEvents(detail.events as ApiEvent[])
  const notifications = detail.notifications as ApiNotification[]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <IncidentDetailView
        incident={incident}
        timeline={timeline}
        notifications={notifications}
      />
    </div>
  )
}
