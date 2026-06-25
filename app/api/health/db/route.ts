import { NextResponse } from "next/server"
import { query } from "@/lib/db"

// pg + the DSQL connector use Node networking (net/tls) — must NOT run on Edge.
export const runtime = "nodejs"
// Health check must always hit the DB, never be statically cached.
export const dynamic = "force-dynamic"

/**
 * Smoke test for the Aurora DSQL connection.
 *   GET /api/health/db
 * Returns the DB clock + whoever is currently on call (from the seed data).
 * If this works, OIDC -> IAM token -> DSQL is wired correctly.
 */
export async function GET() {
  try {
    const { rows } = await query<{ now: string }>("SELECT now() AS now")

    const onCall = await query<{ name: string; starts_at: string; ends_at: string }>(
      `SELECT u.name, s.starts_at, s.ends_at
         FROM shifts s
         JOIN users u ON u.id = s.user_id
        WHERE now() BETWEEN s.starts_at AND s.ends_at`
    )

    return NextResponse.json({
      ok: true,
      now: rows[0]?.now ?? null,
      onCall: onCall.rows,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
