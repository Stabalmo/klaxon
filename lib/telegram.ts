// lib/telegram.ts
// Telegram Bot API helpers + incident notification.
// Token comes from env (TELEGRAM_BOT_TOKEN); never hard-coded.

import { query } from "./db"

type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][]
}

const apiUrl = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

/** Low-level Bot API call. Returns the parsed Telegram response. */
export async function tg(method: string, body: Record<string, unknown>) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN not set" }
  }
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function sendMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: InlineKeyboard,
) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  })
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text })
}

/** Remove the inline buttons from a message (after it's been actioned). */
export function clearButtons(chatId: string | number, messageId: number) {
  return tg("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  })
}

const SEV_EMOJI: Record<string, string> = { SEV1: "🔴", SEV2: "🟠", SEV3: "🟡" }

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function alertText(inc: {
  display_id: string
  title: string
  severity: string
  status: string
  service_slug: string | null
}): string {
  return (
    `${SEV_EMOJI[inc.severity] ?? "⚪"} <b>${inc.severity}</b> · <code>${inc.display_id}</code>\n` +
    `<b>${escapeHtml(inc.title)}</b>\n` +
    `service <code>${escapeHtml(inc.service_slug ?? "?")}</code> · status <b>${inc.status}</b>`
  )
}

function ackButtons(incidentId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Acknowledge", callback_data: `ack:${incidentId}` },
        { text: "✔️ Resolve", callback_data: `resolve:${incidentId}` },
      ],
    ],
  }
}

async function recordNotification(
  incidentId: string,
  userId: string | null,
  status: "sent" | "failed" | "skipped",
) {
  if (!userId) return
  await query(
    `INSERT INTO notifications (incident_id, target_user_id, channel, status)
     VALUES ($1, $2, 'telegram', $3)`,
    [incidentId, userId, status],
  ).catch(() => {})
}

/**
 * Page the assigned on-call user on Telegram (if they linked their account).
 * Side effect — call this AFTER the incident mutation has committed, never
 * inside an OCC tx (which may retry and double-send).
 */
export async function notifyIncident(incidentId: string) {
  const { rows } = await query<{
    id: string
    display_id: string
    title: string
    severity: string
    status: string
    service_slug: string | null
    assigned_user_id: string | null
    telegram_chat_id: string | null
  }>(
    `SELECT i.id, i.display_id, i.title, i.severity, i.status,
            i.assigned_user_id, s.slug AS service_slug, u.telegram_chat_id
       FROM incidents i
       LEFT JOIN services s ON s.id = i.service_id
       LEFT JOIN users    u ON u.id = i.assigned_user_id
      WHERE i.id = $1`,
    [incidentId],
  )
  const inc = rows[0]
  if (!inc) return { sent: false, reason: "incident not found" }
  if (!inc.telegram_chat_id) {
    await recordNotification(incidentId, inc.assigned_user_id, "skipped")
    return { sent: false, reason: "assignee not linked to Telegram" }
  }

  const resp = (await sendMessage(
    inc.telegram_chat_id,
    alertText(inc),
    inc.status === "triggered" ? ackButtons(inc.id) : undefined,
  )) as { ok?: boolean }

  await recordNotification(incidentId, inc.assigned_user_id, resp?.ok ? "sent" : "failed")
  return { sent: !!resp?.ok }
}
