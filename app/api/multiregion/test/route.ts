import { NextResponse } from "next/server"
import { ensureProbeTable, runConsistencyTest, PRIMARY, SECONDARY } from "@/lib/multiregion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle() {
  try {
    await ensureProbeTable()
    const result = await runConsistencyTest()
    return NextResponse.json({
      ok: true,
      nodes: { primary: PRIMARY, secondary: SECONDARY },
      ...result,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
