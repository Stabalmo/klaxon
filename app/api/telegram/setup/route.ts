import { NextResponse } from "next/server"
import { tg } from "@/lib/telegram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * One-shot webhook registration. Hit this once after deploy:
 *   GET https://<your-domain>/api/telegram/setup
 * It points Telegram at /api/telegram/webhook on the SAME origin.
 */
export async function GET(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 500 },
    )
  }

  const origin = new URL(req.url).origin
  const webhookUrl = `${origin}/api/telegram/webhook`

  const result = await tg("setWebhook", {
    url: webhookUrl,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  })

  return NextResponse.json({ ok: true, webhookUrl, telegram: result })
}
