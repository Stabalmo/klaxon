export type IncidentStatus = "triggered" | "acknowledged" | "resolved"
export type Severity = "SEV1" | "SEV2" | "SEV3"

export type Responder = {
  name: string
  initials: string
  /** tailwind color token used for the avatar background */
  tone: string
}

export type Incident = {
  id: string
  /** real DSQL UUID, used for API mutations (ack/resolve). id stays the display_id. */
  dbId?: string
  title: string
  service: string
  severity: Severity
  status: IncidentStatus
  responder: Responder
  /** human-readable relative timestamp */
  createdAt: string
  /** seconds remaining before escalation (triggered only) */
  escalatesInSeconds?: number
  /** who acknowledged (acknowledged only) */
  ackedBy?: string
  /** how the incident was resolved (resolved only) */
  resolvedNote?: string
}

export const responders: Record<string, Responder> = {
  maya: { name: "Maya Chen", initials: "MC", tone: "var(--chart-1)" },
  dev: { name: "Dev Patel", initials: "DP", tone: "var(--acknowledged)" },
  sam: { name: "Sam Rivera", initials: "SR", tone: "var(--chart-3)" },
  jordan: { name: "Jordan Lee", initials: "JL", tone: "#6366a8" },
  alex: { name: "Alex Kim", initials: "AK", tone: "#3d8a7a" },
}

export const incidents: Incident[] = [
  {
    id: "INC-2041",
    title: "Elevated 5xx error rate on checkout",
    service: "checkout-service",
    severity: "SEV1",
    status: "triggered",
    responder: responders.maya,
    createdAt: "2m ago",
    escalatesInSeconds: 272,
  },
  {
    id: "INC-2040",
    title: "Payment authorization latency above 2s p95",
    service: "payments-api",
    severity: "SEV1",
    status: "triggered",
    responder: responders.dev,
    createdAt: "6m ago",
    escalatesInSeconds: 95,
  },
  {
    id: "INC-2039",
    title: "Auth token refresh failures spiking",
    service: "auth-gateway",
    severity: "SEV2",
    status: "triggered",
    responder: responders.sam,
    createdAt: "11m ago",
    escalatesInSeconds: 418,
  },
  {
    id: "INC-2038",
    title: "Notification delivery backlog growing",
    service: "notifications-worker",
    severity: "SEV2",
    status: "acknowledged",
    responder: responders.jordan,
    createdAt: "14m ago",
    ackedBy: "Jordan Lee",
  },
  {
    id: "INC-2037",
    title: "Search results stale for new listings",
    service: "search-indexer",
    severity: "SEV3",
    status: "acknowledged",
    responder: responders.alex,
    createdAt: "23m ago",
    ackedBy: "Alex Kim",
  },
  {
    id: "INC-2035",
    title: "Intermittent 502s from payments gateway",
    service: "payments-api",
    severity: "SEV2",
    status: "resolved",
    responder: responders.maya,
    createdAt: "1h ago",
    resolvedNote: "Resolved 38m ago",
  },
  {
    id: "INC-2031",
    title: "Checkout cart desync after deploy",
    service: "checkout-service",
    severity: "SEV3",
    status: "resolved",
    responder: responders.sam,
    createdAt: "3h ago",
    resolvedNote: "Resolved 2h ago",
  },
]

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function getIncident(id: string): Incident | undefined {
  return incidents.find((inc) => inc.id === id)
}

export type TimelineEventKind =
  | "triggered"
  | "notified"
  | "escalated"
  | "acknowledged"
  | "resolved"

export type TimelineEvent = {
  id: string
  kind: TimelineEventKind
  title: string
  actor: string
  /** relative timestamp, e.g. "2m ago" */
  time: string
}

const responderPool = Object.values(responders)

function parseToSeconds(relative: string): number {
  if (/just now/i.test(relative)) return 0
  const match = relative.match(/(\d+)\s*([smh])/i)
  if (!match) return 120
  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  if (unit === "s") return value
  if (unit === "m") return value * 60
  return value * 3600
}

function formatAgo(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  if (safe <= 5) return "just now"
  if (safe < 60) return `${safe}s ago`
  if (safe < 3600) return `${Math.round(safe / 60)}m ago`
  return `${Math.round(safe / 3600)}h ago`
}

/**
 * Build a chronological event log for an incident based on its current status.
 * Order: triggered -> notified -> escalated -> notified -> acknowledged -> resolved.
 */
export function buildTimeline(incident: Incident): TimelineEvent[] {
  const base = parseToSeconds(incident.createdAt)
  const tier1 = incident.responder
  const tier2 =
    responderPool.find((r) => r.name !== tier1.name) ?? responderPool[0]
  const acker = incident.ackedBy ?? tier1.name

  const events: TimelineEvent[] = [
    {
      id: "triggered",
      kind: "triggered",
      title: "Incident triggered",
      actor: "Klaxon Monitor",
      time: formatAgo(base),
    },
    {
      id: "notified-1",
      kind: "notified",
      title: `Notified ${tier1.name}`,
      actor: "Tier 1 · On-call",
      time: formatAgo(base - 10),
    },
    {
      id: "escalated",
      kind: "escalated",
      title: "Escalated to tier 2",
      actor: "Escalation policy",
      time: formatAgo(base - 120),
    },
    {
      id: "notified-2",
      kind: "notified",
      title: `Notified ${tier2.name}`,
      actor: "Tier 2 · On-call",
      time: formatAgo(base - 130),
    },
  ]

  if (incident.status === "acknowledged" || incident.status === "resolved") {
    events.push({
      id: "acknowledged",
      kind: "acknowledged",
      title: `Acknowledged by ${acker}`,
      actor: acker,
      time: formatAgo(base - 200),
    })
  }

  if (incident.status === "resolved") {
    events.push({
      id: "resolved",
      kind: "resolved",
      title: "Incident resolved",
      actor: acker,
      time: formatAgo(base - 260),
    })
  }

  return events
}

/* ------------------------------------------------------------------ */
/* Mapping real DSQL data (from the API) into the UI shapes above.     */
/* ------------------------------------------------------------------ */

export type ApiIncident = {
  id: string
  display_id: string
  title: string
  severity: Severity
  status: IncidentStatus
  created_at: string
  next_escalation_at: string | null
  acked_at: string | null
  resolved_at: string | null
  service_slug: string | null
  assignee_name: string | null
  acked_by_name: string | null
}

const avatarTones = [
  "var(--chart-1)",
  "var(--acknowledged)",
  "var(--chart-3)",
  "#6366a8",
  "#3d8a7a",
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  const out = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
  return out.toUpperCase() || "?"
}

function toneOf(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return avatarTones[h % avatarTones.length]
}

/** Relative "Nm ago" from an ISO timestamp (past). */
export function relativeTime(iso: string | null): string {
  if (!iso) return ""
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  const safe = Math.max(0, Math.round(seconds))
  if (safe <= 5) return "just now"
  if (safe < 60) return `${safe}s ago`
  if (safe < 3600) return `${Math.round(safe / 60)}m ago`
  return `${Math.round(safe / 3600)}h ago`
}

/** Map a DSQL incident row into the UI Incident shape. */
export function incidentFromApi(row: ApiIncident): Incident {
  const responderName = row.assignee_name ?? "Unassigned"

  let escalatesInSeconds: number | undefined
  if (row.status === "triggered" && row.next_escalation_at) {
    escalatesInSeconds = Math.max(
      0,
      Math.round((new Date(row.next_escalation_at).getTime() - Date.now()) / 1000),
    )
  }

  return {
    id: row.display_id,
    dbId: row.id,
    title: row.title,
    service: row.service_slug ?? "unknown-service",
    severity: row.severity,
    status: row.status,
    responder: {
      name: responderName,
      initials: initialsOf(responderName),
      tone: toneOf(responderName),
    },
    createdAt: relativeTime(row.created_at),
    escalatesInSeconds,
    ackedBy: row.acked_by_name ?? row.assignee_name ?? undefined,
    resolvedNote: row.resolved_at
      ? `Resolved ${relativeTime(row.resolved_at)}`
      : undefined,
  }
}

export type ApiEvent = {
  id: string
  type: TimelineEventKind
  actor: string | null
  detail: string | null
  created_at: string
}

const eventTitles: Record<TimelineEventKind, string> = {
  triggered: "Incident triggered",
  notified: "Responder notified",
  escalated: "Escalated",
  acknowledged: "Acknowledged",
  resolved: "Incident resolved",
}

/** Map real incident_events rows into the timeline shape. */
export function timelineFromEvents(events: ApiEvent[]): TimelineEvent[] {
  return events.map((e) => ({
    id: e.id,
    kind: e.type,
    title: e.detail || eventTitles[e.type] || e.type,
    actor: e.actor ?? "system",
    time: relativeTime(e.created_at),
  }))
}
