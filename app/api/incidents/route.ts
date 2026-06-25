import { NextResponse } from "next/server"
import { listIncidents } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const incidents = await listIncidents()
    return NextResponse.json({ ok: true, count: incidents.length, incidents })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
