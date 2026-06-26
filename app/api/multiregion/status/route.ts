import { NextResponse } from "next/server"
import { getServiceStatus } from "@/lib/multiregion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const status = await getServiceStatus()
    return NextResponse.json({ ok: true, ...status })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
