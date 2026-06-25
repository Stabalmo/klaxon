import { NextResponse } from "next/server"
import { acknowledgeIncident } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// id = incident UUID
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string }
    const result = await acknowledgeIncident(id, body?.userId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
