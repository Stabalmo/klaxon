import { NextResponse } from "next/server"
import { ingestAlert, type NormalizedAlert, type Severity } from "@/lib/db"
import { notifyIncident } from "@/lib/telegram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Map arbitrary severity strings into our 3 levels. */
function normalizeSeverity(value: unknown): Severity {
  const s = String(value ?? "").toLowerCase()
  if (["sev1", "critical", "crit", "p1", "fatal", "page", "emergency"].includes(s)) return "SEV1"
  if (["sev3", "info", "informational", "low", "p3", "minor", "notice"].includes(s)) return "SEV3"
  return "SEV2" // sev2 / warning / error / unknown default
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown-service"
}

/**
 * Accepts either:
 *   - Prometheus Alertmanager webhook:  { alerts: [ { labels, annotations, fingerprint, status } ] }
 *   - Generic JSON:                     { dedup_key, title, severity, service }
 * Returns a list of normalized alerts to ingest (only firing ones).
 */
function normalize(body: any): NormalizedAlert[] {
  // Alertmanager shape
  if (body && Array.isArray(body.alerts)) {
    return body.alerts
      .filter((a: any) => (a?.status ?? "firing") === "firing")
      .map((a: any): NormalizedAlert => {
        const labels = a.labels ?? {}
        const annotations = a.annotations ?? {}
        const serviceSlug = slugify(labels.service ?? labels.job ?? labels.namespace ?? "unknown-service")
        const dedupKey =
          a.fingerprint ??
          `${labels.alertname ?? "alert"}:${serviceSlug}:${labels.instance ?? ""}`
        return {
          dedupKey: String(dedupKey),
          title: String(annotations.summary ?? annotations.description ?? labels.alertname ?? "Alert"),
          severity: normalizeSeverity(labels.severity),
          serviceSlug,
        }
      })
  }

  // Generic single-alert shape
  if (body && (body.title || body.dedup_key || body.dedupKey)) {
    const serviceSlug = slugify(body.service ?? body.serviceSlug ?? "unknown-service")
    const dedupKey =
      body.dedup_key ?? body.dedupKey ?? body.fingerprint ?? `${serviceSlug}:${body.title ?? "alert"}`
    return [
      {
        dedupKey: String(dedupKey),
        title: String(body.title ?? "Untitled alert"),
        severity: normalizeSeverity(body.severity),
        serviceSlug,
      },
    ]
  }

  return []
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 })
  }

  const alerts = normalize(body)
  if (alerts.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no firing alerts recognized in payload" },
      { status: 400 }
    )
  }

  try {
    const results = []
    for (const alert of alerts) {
      const r = await ingestAlert(alert)
      // Page the on-call user — only for freshly created incidents, and
      // after the tx has committed (never inside the OCC retry).
      if (r.created) {
        await notifyIncident(r.incident.id).catch(() => {})
      }
      results.push({
        created: r.created,
        id: r.incident.id,
        display_id: r.incident.display_id,
        status: r.incident.status,
      })
    }
    return NextResponse.json({ ok: true, count: results.length, incidents: results })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
