import { NextResponse } from "next/server"
import { heartbeat } from "@/lib/multiregion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle() {
  try {
    const result = await heartbeat()
    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
