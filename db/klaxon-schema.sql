-- ============================================================
-- Klaxon — schema for Amazon Aurora DSQL
-- ============================================================
-- HOW TO RUN (DSQL Query Editor — Storage → Open in AWS, connect as admin):
--   Aurora DSQL allows only ONE DDL statement per transaction, and DDL
--   cannot be mixed with DML (INSERT) in the same transaction. The Query
--   Editor wraps a multi-statement run in a single transaction, so running
--   this whole file at once fails with a misleading "syntax error".
--
--   ==> Run ONE statement at a time. Each statement below is separated by a
--       "-- ▸ run separately" marker. Put the cursor on a statement (or
--       select it) and Run, then move to the next.
--
-- DSQL notes:
--   * NO foreign-key constraints — relationships are logical (app-enforced).
--   * UUID primary keys; NO sequences / SERIAL (human ids are app-generated).
--   * Secondary indexes MUST use CREATE INDEX ASYNC (build runs in background;
--     check status with:  SELECT * FROM sys.jobs; ).
--   * NO JSONB / triggers / PL-pgSQL — event detail is plain TEXT.
--   * status / severity kept as TEXT (no ENUM types), validated in app.
--   * If gen_random_uuid() is rejected, drop the DEFAULT and generate UUIDs
--     in the app (crypto.randomUUID()).
-- ============================================================


-- ===========================================================
-- 1) TABLES  — run each CREATE TABLE separately (▸)
-- ===========================================================

-- ▸ run separately
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ▸ run separately
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  telegram_chat_id TEXT,                 -- set when user links Telegram
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ▸ run separately
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ▸ run separately
CREATE TABLE shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL,            -- -> schedules.id
  user_id      UUID NOT NULL,            -- -> users.id
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL
);

-- ▸ run separately
CREATE TABLE escalation_policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL,             -- -> services.id
  name        TEXT NOT NULL
);

-- ▸ run separately
CREATE TABLE escalation_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL,         -- -> escalation_policies.id
  step_order      INT  NOT NULL,
  target_kind     TEXT NOT NULL,         -- 'schedule' | 'user'
  target_id       UUID NOT NULL,         -- -> schedules.id or users.id
  timeout_seconds INT  NOT NULL DEFAULT 300
);

-- ▸ run separately
CREATE TABLE incidents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id         TEXT NOT NULL,                     -- 'INC-2041', app-generated
  service_id         UUID NOT NULL,                     -- -> services.id
  policy_id          UUID,                              -- -> escalation_policies.id
  dedup_key          TEXT NOT NULL,                     -- idempotency for ingest
  title              TEXT NOT NULL,
  severity           TEXT NOT NULL,                     -- 'SEV1' | 'SEV2' | 'SEV3'
  status             TEXT NOT NULL DEFAULT 'triggered', -- triggered|acknowledged|resolved
  current_step       INT  NOT NULL DEFAULT 0,
  next_escalation_at TIMESTAMPTZ,                       -- the escalation engine reads this
  assigned_user_id   UUID,
  acked_by           UUID,
  acked_at           TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ▸ run separately
CREATE TABLE incident_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL,            -- -> incidents.id
  type         TEXT NOT NULL,            -- triggered|notified|escalated|acknowledged|resolved
  actor        TEXT,                     -- user name or 'system'
  detail       TEXT,                     -- freeform text (no JSONB on DSQL)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ▸ run separately
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL,         -- -> incidents.id
  target_user_id  UUID NOT NULL,         -- -> users.id
  channel         TEXT NOT NULL,         -- 'telegram' | 'email' | 'slack'
  status          TEXT NOT NULL DEFAULT 'queued', -- queued|sent|failed|skipped
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===========================================================
-- 2) SEED  — run each INSERT separately (▸).
--    Fixed UUIDs so the logical references line up.
-- ===========================================================

-- ▸ run separately
INSERT INTO users (id, name, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Maya Chen', 'maya@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Dev Patel', 'dev@example.com');

-- ▸ run separately
INSERT INTO services (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'checkout-service', 'checkout-service');

-- ▸ run separately
INSERT INTO schedules (id, name, timezone) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Primary on-call', 'UTC');

-- ▸ run separately  — Maya is on call now (24h window), Dev is next.
INSERT INTO shifts (schedule_id, user_id, starts_at, ends_at) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', now() - INTERVAL '1 hour',  now() + INTERVAL '23 hour'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', now() + INTERVAL '23 hour', now() + INTERVAL '47 hour');

-- ▸ run separately
INSERT INTO escalation_policies (id, service_id, name) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Default checkout policy');

-- ▸ run separately  — Step 0: on-call schedule, 60s timeout (short, for demo). Step 1: escalate to Dev.
INSERT INTO escalation_steps (policy_id, step_order, target_kind, target_id, timeout_seconds) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 0, 'schedule', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 60),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 'user',     '22222222-2222-2222-2222-222222222222', 60);


-- ===========================================================
-- 3) SECONDARY INDEXES — DSQL requires ASYNC.
--    Run each CREATE INDEX ASYNC SEPARATELY (▸), one per transaction.
--    They build in the background; verify with:  SELECT * FROM sys.jobs;
-- ===========================================================

-- ▸ run separately  (escalation engine reads incidents by status + due time)
CREATE INDEX ASYNC idx_incidents_engine ON incidents (status, next_escalation_at);

-- ▸ run separately  (ingest idempotency lookup by dedup_key)
CREATE INDEX ASYNC idx_incidents_dedup ON incidents (dedup_key);

-- ▸ run separately  (incident timeline)
CREATE INDEX ASYNC idx_events_incident ON incident_events (incident_id, created_at);

-- ▸ run separately  (who is on call now)
CREATE INDEX ASYNC idx_shifts_lookup ON shifts (schedule_id, starts_at, ends_at);
