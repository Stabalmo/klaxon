// lib/email.ts
// Secondary notification channel via Resend. Telegram stays primary.
// Needs RESEND_API_KEY; from-address defaults to Resend's shared sender.

import { query } from "./db"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return { ok: false, skipped: true as const }
  const from = process.env.RESEND_FROM || "Klaxon <onboarding@resend.dev>"
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

const SEV_COLOR: Record<string, string> = {
  SEV1: "#FF4D3D",
  SEV2: "#FFB020",
  SEV3: "#8A8A8A",
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function incidentEmailHtml(inc: {
  display_id: string
  title: string
  severity: string
  status: string
  service_slug: string | null
  name: string | null
  link: string
}): string {
  const color = SEV_COLOR[inc.severity] ?? "#8A8A8A"
  return `<!doctype html><html><body style="margin:0;background:#0d0d0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161619;border:1px solid #2a2a30;border-radius:12px;overflow:hidden;">
<tr><td style="height:4px;background:${color};"></td></tr>
<tr><td style="padding:24px 28px;">
<div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:${color};font-weight:600;letter-spacing:.04em;">${inc.severity} · ${escapeHtml(inc.display_id)}</div>
<div style="font-size:18px;color:#f4f4f5;font-weight:600;margin:8px 0 4px;">${escapeHtml(inc.title)}</div>
<div style="font-size:13px;color:#a1a1aa;">service <span style="font-family:ui-monospace,Menlo,monospace;color:#d4d4d8;">${escapeHtml(inc.service_slug ?? "?")}</span> · status <b style="color:#e4e4e7;">${escapeHtml(inc.status)}</b></div>
<div style="font-size:13px;color:#a1a1aa;margin-top:6px;">Assigned to ${escapeHtml(inc.name ?? "on-call")}</div>
<a href="${inc.link}" style="display:inline-block;margin-top:20px;background:${color};color:#0d0d0f;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">View &amp; acknowledge</a>
<div style="font-size:12px;color:#71717a;margin-top:20px;">Klaxon · on-call alerting on Aurora DSQL</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

async function recordNotification(
  incidentId: string,
  userId: string | null,
  status: "sent" | "failed" | "skipped",
) {
  if (!userId) return
  await query(
    `INSERT INTO notifications (incident_id, target_user_id, channel, status)
     VALUES ($1, $2, 'email', $3)`,
    [incidentId, userId, status],
  ).catch(() => {})
}

/**
 * Email the assigned on-call user about an incident (secondary channel).
 * baseUrl is used to build the deep link back to the incident page.
 */
export async function emailIncident(incidentId: string, baseUrl: string) {
  const { rows } = await query<{
    id: string
    display_id: string
    title: string
    severity: string
    status: string
    service_slug: string | null
    assigned_user_id: string | null
    email: string | null
    name: string | null
  }>(
    `SELECT i.id, i.display_id, i.title, i.severity, i.status,
            i.assigned_user_id, s.slug AS service_slug, u.email, u.name
       FROM incidents i
       LEFT JOIN services s ON s.id = i.service_id
       LEFT JOIN users    u ON u.id = i.assigned_user_id
      WHERE i.id = $1`,
    [incidentId],
  )
  const inc = rows[0]
  if (!inc) return { sent: false, reason: "incident not found" }
  if (!inc.email) {
    await recordNotification(incidentId, inc.assigned_user_id, "skipped")
    return { sent: false, reason: "assignee has no email" }
  }

  const html = incidentEmailHtml({
    ...inc,
    link: `${baseUrl}/incidents/${inc.display_id}`,
  })
  const subject = `[${inc.severity}] ${inc.display_id} · ${inc.title}`
  const r = await sendEmail(inc.email, subject, html)

  await recordNotification(
    incidentId,
    inc.assigned_user_id,
    r.ok ? "sent" : "skipped" in r && r.skipped ? "skipped" : "failed",
  )
  return { sent: !!r.ok }
}
