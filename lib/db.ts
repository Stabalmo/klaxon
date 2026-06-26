// lib/db.ts
// Aurora DSQL connection for Next.js on Vercel.
//
// Install:
//   npm install pg @aws/aurora-dsql-node-postgres-connector @vercel/functions
//   npm install --save-dev @types/pg
//
// Auth: no password. Vercel OIDC Federation exchanges a per-request OIDC
// token for AWS credentials (assuming AWS_ROLE_ARN), and the DSQL connector
// turns those into a short-lived IAM auth token automatically.
//
// Env vars are injected by the Vercel <-> AWS DSQL integration:
//   PGHOST, PGDATABASE, AWS_ROLE_ARN, AWS_REGION  (run `vercel env pull`
//   to get them locally).
//
// NOTE: cross-check the exact import/option names against the
// "@aws/aurora-dsql-node-postgres-connector" snippet shown on your DSQL
// integration page — that snippet is authoritative for your setup.

import { AuroraDSQLClient, isOCCError } from "@aws/aurora-dsql-node-postgres-connector";
import { awsCredentialsProvider } from "@vercel/functions/oidc";

function newClient(host: string = process.env.PGHOST!) {
  return new AuroraDSQLClient({
    host,
    database: process.env.PGDATABASE ?? "postgres",
    user: process.env.PGUSER ?? "admin",
    // Vercel OIDC -> AWS STS -> credentials; connector signs the DSQL token.
    // The connector derives the region from `host`, so the same role can
    // reach any peered regional endpoint.
    customCredentialsProvider: awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN!,
    }),
    ssl: { rejectUnauthorized: true },
  });
}

/**
 * Run a query with a fresh per-request connection.
 * Serverless-friendly: connect -> query -> end. DSQL tokens are short-lived,
 * so we don't hold long pools across invocations.
 */
export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const client = newClient();
  await client.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } finally {
    await client.end();
  }
}

/**
 * Same as query(), but against a SPECIFIC regional endpoint.
 * Used by the multi-region consistency demo to write in one region and
 * read in another against the same logical DSQL database.
 */
export async function queryOn<T = any>(
  host: string,
  text: string,
  params: any[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const client = newClient(host);
  await client.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } finally {
    await client.end();
  }
}

/**
 * Run several statements inside ONE transaction on a single connection.
 * Use this for the ack / escalation mutations so the whole unit is atomic
 * and a concurrency conflict rolls the whole thing back.
 */
export async function tx<T>(
  fn: (q: (text: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const client = newClient();
  await client.connect();
  try {
    await client.query("BEGIN");
    const result = await fn((text, params = []) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    await client.end();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Optimistic-concurrency retry wrapper.
 * DSQL returns SQLSTATE 40001 (serialization failure / OC000) when two
 * transactions touch the same row. We retry the loser with exponential
 * backoff + jitter. Make the wrapped operation IDEMPOTENT so a retry that
 * re-reads new state safely no-ops (e.g. escalation sees status already
 * 'acknowledged' and stops).
 */
export async function withRetry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      // isOCCError covers DSQL optimistic-concurrency conflicts: SQLSTATE
      // 40001 plus the connector's OC000 / OC001 commit-time codes.
      if (isOCCError(e) && attempt < max) {
        const cap = Math.min(2000, 50 * 2 ** attempt);
        await sleep(Math.random() * cap); // full-jitter backoff
        continue;
      }
      throw e;
    }
  }
}

/**
 * Example: acknowledge an incident safely under contention.
 * The escalation engine running concurrently on the same row will conflict;
 * exactly one commits, the other retries and finds it already acknowledged.
 */
export async function acknowledgeIncident(incidentId: string, userId?: string) {
  return withRetry(() =>
    tx(async (q) => {
      const { rows } = await q(
        "SELECT status, assigned_user_id FROM incidents WHERE id = $1",
        [incidentId]
      );
      if (!rows.length) throw new Error("incident not found");
      if (rows[0].status !== "triggered") {
        return { changed: false, status: rows[0].status }; // idempotent no-op
      }

      // Who acked: explicit user (e.g. Telegram linker) or the assignee.
      const ackerId: string | null = userId ?? rows[0].assigned_user_id ?? null;
      const actorName = ackerId
        ? (await q("SELECT name FROM users WHERE id = $1", [ackerId])).rows[0]?.name ?? "responder"
        : "responder";

      await q(
        `UPDATE incidents
            SET status = 'acknowledged',
                acked_by = $2,
                acked_at = now(),
                next_escalation_at = NULL
          WHERE id = $1`,
        [incidentId, ackerId]
      );
      await q(
        `INSERT INTO incident_events (incident_id, type, actor, detail)
         VALUES ($1, 'acknowledged', $2, 'acknowledged by responder')`,
        [incidentId, actorName]
      );
      return { changed: true, status: "acknowledged" };
    })
  );
}

/**
 * Resolve an incident. Idempotent: a second resolve is a no-op.
 * Clears next_escalation_at so the engine never touches it again.
 */
export async function resolveIncident(incidentId: string, userId?: string) {
  return withRetry(() =>
    tx(async (q) => {
      const { rows } = await q(
        "SELECT status FROM incidents WHERE id = $1",
        [incidentId]
      );
      if (!rows.length) throw new Error("incident not found");
      if (rows[0].status === "resolved") {
        return { changed: false, status: "resolved" }; // idempotent
      }

      const actorName = userId
        ? (await q("SELECT name FROM users WHERE id = $1", [userId])).rows[0]?.name ?? "responder"
        : "responder";

      await q(
        `UPDATE incidents
            SET status = 'resolved',
                resolved_at = now(),
                next_escalation_at = NULL
          WHERE id = $1`,
        [incidentId]
      );
      await q(
        `INSERT INTO incident_events (incident_id, type, actor, detail)
         VALUES ($1, 'resolved', $2, 'incident resolved')`,
        [incidentId, actorName]
      );
      return { changed: true, status: "resolved" };
    })
  );
}

/* ------------------------------------------------------------------ */
/* Incident domain operations                                          */
/* ------------------------------------------------------------------ */

export type Severity = "SEV1" | "SEV2" | "SEV3";

/** Normalized alert ready for ingest (one incident). */
export type NormalizedAlert = {
  dedupKey: string;
  title: string;
  severity: Severity;
  serviceSlug: string;
};

export type IngestResult = {
  created: boolean;
  incident: any;
};

/**
 * Idempotently turn an alert into a triggered incident.
 *
 * Idempotency: while an incident with the same dedup_key is still open
 * (status != 'resolved'), a repeat ingest is a no-op and returns the
 * existing incident. This is what makes Alertmanager's repeated "firing"
 * webhooks safe.
 *
 * Wrapped in withRetry+tx so it is OCC-safe under contention.
 */
export async function ingestAlert(alert: NormalizedAlert): Promise<IngestResult> {
  return withRetry(() =>
    tx(async (q) => {
      // 1) Dedup: existing OPEN incident with this key?
      const existing = await q(
        `SELECT * FROM incidents
          WHERE dedup_key = $1 AND status != 'resolved'
          ORDER BY created_at DESC
          LIMIT 1`,
        [alert.dedupKey]
      );
      if (existing.rows.length) {
        return { created: false, incident: existing.rows[0] };
      }

      // 2) Resolve (or create) the service by slug.
      let serviceId: string;
      const svc = await q(`SELECT id FROM services WHERE slug = $1 LIMIT 1`, [
        alert.serviceSlug,
      ]);
      if (svc.rows.length) {
        serviceId = svc.rows[0].id;
      } else {
        const ins = await q(
          `INSERT INTO services (name, slug) VALUES ($1, $1) RETURNING id`,
          [alert.serviceSlug]
        );
        serviceId = ins.rows[0].id;
      }

      // 3) Find the escalation policy + first step (timeout + who to page).
      let policyId: string | null = null;
      let timeoutSeconds = 60;
      let onCallUserId: string | null = null;

      const pol = await q(
        `SELECT id FROM escalation_policies WHERE service_id = $1 LIMIT 1`,
        [serviceId]
      );
      if (pol.rows.length) {
        policyId = pol.rows[0].id;
        const step0 = await q(
          `SELECT target_kind, target_id, timeout_seconds
             FROM escalation_steps
            WHERE policy_id = $1
            ORDER BY step_order ASC
            LIMIT 1`,
          [policyId]
        );
        if (step0.rows.length) {
          timeoutSeconds = step0.rows[0].timeout_seconds ?? 60;
          if (step0.rows[0].target_kind === "schedule") {
            const onc = await q(
              `SELECT user_id FROM shifts
                WHERE schedule_id = $1 AND now() BETWEEN starts_at AND ends_at
                ORDER BY starts_at DESC
                LIMIT 1`,
              [step0.rows[0].target_id]
            );
            onCallUserId = onc.rows[0]?.user_id ?? null;
          } else if (step0.rows[0].target_kind === "user") {
            onCallUserId = step0.rows[0].target_id;
          }
        }
      }

      // 4) Human-readable display id (no sequences on DSQL).
      const cnt = await q(`SELECT count(*)::int AS c FROM incidents`);
      const displayId = `INC-${2041 + (cnt.rows[0]?.c ?? 0)}`;

      // 5) Create the incident, armed to escalate after the step-0 timeout.
      const inc = await q(
        `INSERT INTO incidents
           (display_id, service_id, policy_id, dedup_key, title, severity,
            status, current_step, next_escalation_at, assigned_user_id)
         VALUES
           ($1, $2, $3, $4, $5, $6,
            'triggered', 0, now() + ($7::int * interval '1 second'), $8)
         RETURNING *`,
        [
          displayId,
          serviceId,
          policyId,
          alert.dedupKey,
          alert.title,
          alert.severity,
          timeoutSeconds,
          onCallUserId,
        ]
      );

      await q(
        `INSERT INTO incident_events (incident_id, type, actor, detail)
         VALUES ($1, 'triggered', 'system', $2)`,
        [inc.rows[0].id, `Alert ingested for ${alert.serviceSlug}`]
      );

      return { created: true, incident: inc.rows[0] };
    })
  );
}

/** List incidents for the dashboard, newest first. */
export async function listIncidents(limit = 100) {
  const { rows } = await query(
    `SELECT i.id, i.display_id, i.title, i.severity, i.status,
            i.created_at, i.next_escalation_at, i.acked_at, i.resolved_at,
            s.slug AS service_slug,
            u.name  AS assignee_name,
            a.name  AS acked_by_name
       FROM incidents i
       LEFT JOIN services s ON s.id = i.service_id
       LEFT JOIN users    u ON u.id = i.assigned_user_id
       LEFT JOIN users    a ON a.id = i.acked_by
      ORDER BY i.created_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

/** Full incident + its event timeline, looked up by human display_id. */
export async function getIncidentDetail(displayId: string) {
  const inc = await query(
    `SELECT i.id, i.display_id, i.title, i.severity, i.status,
            i.created_at, i.next_escalation_at, i.acked_at, i.resolved_at,
            s.slug AS service_slug,
            u.name  AS assignee_name,
            a.name  AS acked_by_name
       FROM incidents i
       LEFT JOIN services s ON s.id = i.service_id
       LEFT JOIN users    u ON u.id = i.assigned_user_id
       LEFT JOIN users    a ON a.id = i.acked_by
      WHERE i.display_id = $1
      LIMIT 1`,
    [displayId]
  );
  if (!inc.rows.length) return null;

  const events = await query(
    `SELECT id, type, actor, detail, created_at
       FROM incident_events
      WHERE incident_id = $1
      ORDER BY created_at ASC`,
    [inc.rows[0].id]
  );

  const notifications = await query(
    `SELECT n.id, n.channel, n.status, n.created_at, u.name AS target_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.target_user_id
      WHERE n.incident_id = $1
      ORDER BY n.created_at ASC`,
    [inc.rows[0].id]
  );

  return {
    incident: inc.rows[0],
    events: events.rows,
    notifications: notifications.rows,
  };
}

/**
 * Escalation engine — advance every triggered incident whose timer is due.
 *
 * This is the heart of the correctness story. Each incident is advanced in
 * its own withRetry+tx that RE-READS the row: if an ack landed first the row
 * is no longer 'triggered' (or no longer due) and we no-op. If an ack and
 * this escalation hit the same row concurrently, DSQL rejects the loser with
 * an OCC conflict (40001); withRetry re-runs it, it re-reads the now-acked
 * state, and stops. No double-page, no dropped alert.
 */
export async function escalateDueIncidents() {
  const due = await query<{ id: string }>(
    `SELECT id FROM incidents
      WHERE status = 'triggered'
        AND next_escalation_at IS NOT NULL
        AND next_escalation_at <= now()
      LIMIT 100`
  );

  const results: { id: string; action: string; step?: number }[] = [];

  for (const { id } of due.rows) {
    const r = await withRetry(() =>
      tx(async (q) => {
        // Re-read inside the tx; this is the idempotency / race guard.
        const cur = await q(
          `SELECT policy_id, current_step, status,
                  (next_escalation_at IS NOT NULL AND next_escalation_at <= now()) AS due
             FROM incidents WHERE id = $1`,
          [id]
        );
        if (!cur.rows.length) return { id, action: "gone" };
        const inc = cur.rows[0];
        if (inc.status !== "triggered") return { id, action: "skipped:acked" };
        if (!inc.due) return { id, action: "skipped:not-due" };

        const nextOrder = (inc.current_step ?? 0) + 1;
        const steps = await q(
          `SELECT step_order, target_kind, target_id, timeout_seconds
             FROM escalation_steps
            WHERE policy_id = $1
            ORDER BY step_order ASC`,
          [inc.policy_id]
        );
        const nextStep = steps.rows.find((s: any) => s.step_order === nextOrder);

        if (!nextStep) {
          // No further steps — stop the timer but leave it triggered.
          await q(
            `UPDATE incidents SET next_escalation_at = NULL WHERE id = $1`,
            [id]
          );
          await q(
            `INSERT INTO incident_events (incident_id, type, actor, detail)
             VALUES ($1, 'escalated', 'system', 'no further escalation steps')`,
            [id]
          );
          return { id, action: "exhausted" };
        }

        // Resolve who the next step pages.
        let nextUser: string | null = null;
        if (nextStep.target_kind === "schedule") {
          const onc = await q(
            `SELECT user_id FROM shifts
              WHERE schedule_id = $1 AND now() BETWEEN starts_at AND ends_at
              ORDER BY starts_at DESC LIMIT 1`,
            [nextStep.target_id]
          );
          nextUser = onc.rows[0]?.user_id ?? null;
        } else {
          nextUser = nextStep.target_id;
        }

        await q(
          `UPDATE incidents
              SET current_step = $2,
                  assigned_user_id = $3,
                  next_escalation_at = now() + ($4::int * interval '1 second')
            WHERE id = $1`,
          [id, nextOrder, nextUser, nextStep.timeout_seconds]
        );
        await q(
          `INSERT INTO incident_events (incident_id, type, actor, detail)
           VALUES ($1, 'escalated', 'system', $2)`,
          [id, `escalated to step ${nextOrder}`]
        );
        return { id, action: "escalated", step: nextOrder };
      })
    );
    results.push(r);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* Telegram account linking                                            */
/* ------------------------------------------------------------------ */

/** Link a Telegram chat to a user (matched by email). Returns the user or null. */
export async function linkTelegramByEmail(email: string, chatId: string) {
  return withRetry(() =>
    tx(async (q) => {
      const { rows } = await q(
        "SELECT id, name FROM users WHERE email = $1 LIMIT 1",
        [email],
      );
      if (!rows.length) return null;
      await q("UPDATE users SET telegram_chat_id = $2 WHERE id = $1", [
        rows[0].id,
        chatId,
      ]);
      return rows[0] as { id: string; name: string };
    }),
  );
}

/** Resolve a user from their Telegram chat id (for attributing acks). */
export async function getUserByChatId(chatId: string) {
  const { rows } = await query<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE telegram_chat_id = $1 LIMIT 1",
    [chatId],
  );
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Dashboard stats + channel status                                    */
/* ------------------------------------------------------------------ */

/** Live counts + mean-time-to-acknowledge (seconds), computed in DSQL. */
export async function getStats() {
  const { rows } = await query<{
    open: string | null;
    acknowledged: string | null;
    resolved: string | null;
    mtta_seconds: string | null;
  }>(
    `SELECT
       sum(CASE WHEN status = 'triggered'    THEN 1 ELSE 0 END) AS open,
       sum(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) AS acknowledged,
       sum(CASE WHEN status = 'resolved'     THEN 1 ELSE 0 END) AS resolved,
       avg(CASE WHEN acked_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (acked_at - created_at)) END) AS mtta_seconds
     FROM incidents`,
  );
  const r = rows[0] ?? {};
  return {
    open: Number(r.open ?? 0),
    acknowledged: Number(r.acknowledged ?? 0),
    resolved: Number(r.resolved ?? 0),
    mttaSeconds: r.mtta_seconds == null ? null : Number(r.mtta_seconds),
  };
}

/** Per-user channel reachability for the settings page. */
export async function getChannelStatus() {
  const { rows } = await query<{
    name: string;
    email: string | null;
    telegram: boolean;
  }>(
    `SELECT name, email, (telegram_chat_id IS NOT NULL) AS telegram
       FROM users ORDER BY name`,
  );
  return rows;
}
