import { NextResponse } from "next/server"
import { setRegionDisabled } from "@/lib/multiregion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      region?: string
      disabled?: boolean
    }
    if (!body.region || typeof body.disabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "expected { region, disabled }" },
        { status: 400 },
      )
    }
    const status = await setRegionDisabled(body.region, body.disabled)
    return NextResponse.json({ ok: true, ...status })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
