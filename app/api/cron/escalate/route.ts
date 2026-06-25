import { NextResponse } from "next/server"
import { escalateDueIncidents } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Escalation engine — invoked by Vercel Cron (GET) every minute.
 * Also accepts POST for manual triggering during a demo.
 *
 * If CRON_SECRET is set, Vercel sends it as a Bearer token; we enforce it.
 * Left open when unset so local/demo triggering is frictionless.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
  }

  try {
    const results = await escalateDueIncidents()
    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
