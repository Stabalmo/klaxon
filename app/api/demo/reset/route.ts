import { NextResponse } from "next/server"
import { resetDemoIncidents } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const result = await resetDemoIncidents()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
