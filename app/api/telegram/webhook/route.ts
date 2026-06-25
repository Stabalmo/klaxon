import { NextResponse } from "next/server"
import {
  acknowledgeIncident,
  resolveIncident,
  linkTelegramByEmail,
  getUserByChatId,
} from "@/lib/db"
import { answerCallback, clearButtons, sendMessage } from "@/lib/telegram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Telegram pushes updates here. We always answer 200 so it doesn't retry-storm.
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  if (!update) return NextResponse.json({ ok: true })

  try {
    if (update.callback_query) await handleCallback(update.callback_query)
    else if (update.message?.text) await handleMessage(update.message)
  } catch {
    /* swallow — never make Telegram retry on our errors */
  }

  return NextResponse.json({ ok: true })
}

// Inline button taps: "ack:<uuid>" / "resolve:<uuid>"
async function handleCallback(cq: any) {
  const [action, incidentId] = String(cq.data ?? "").split(":")
  const chatId = String(cq.from?.id)
  const user = await getUserByChatId(chatId)

  let toast = "Done"
  if (action === "ack" && incidentId) {
    const r = await acknowledgeIncident(incidentId, user?.id)
    toast = r.changed ? "Acknowledged ✓" : `Already ${r.status}`
  } else if (action === "resolve" && incidentId) {
    const r = await resolveIncident(incidentId, user?.id)
    toast = r.changed ? "Resolved ✓" : "Already resolved"
  }

  await answerCallback(cq.id, toast)
  if (cq.message) {
    // Drop the buttons so it can't be double-tapped; keep the alert text.
    await clearButtons(cq.message.chat.id, cq.message.message_id)
  }
}

// Commands: /start, /link <email>, /whoami
async function handleMessage(msg: any) {
  const text: string = String(msg.text).trim()
  const chatId = String(msg.chat.id)

  if (text.startsWith("/link")) {
    const email = text.split(/\s+/)[1]
    if (!email) {
      await sendMessage(chatId, "Usage: <code>/link your-email@example.com</code>")
      return
    }
    const u = await linkTelegramByEmail(email, chatId)
    await sendMessage(
      chatId,
      u
        ? `✅ Linked as <b>${u.name}</b>. Klaxon will page you here.`
        : `No user found with email <code>${email}</code>.`,
    )
    return
  }

  if (text.startsWith("/whoami")) {
    const u = await getUserByChatId(chatId)
    await sendMessage(
      chatId,
      u ? `You are linked as <b>${u.name}</b>.` : "Not linked. Use <code>/link &lt;email&gt;</code>.",
    )
    return
  }

  // /start and everything else
  await sendMessage(
    chatId,
    "👋 <b>Klaxon</b> on-call bot.\n\nLink your account to receive pages:\n<code>/link your-email@example.com</code>\n\nThen alerts arrive here with Acknowledge / Resolve buttons.",
  )
}
