-- Migration 045: Restrict suggestions SELECT to service_role only
-- The "Public read suggestions" policy (migration 017) exposes submitter PII
-- (submitter_ip, submitter_email) to anyone with the anon key.
-- The existing "Service role full access suggestions" policy already covers
-- admin reads via createServiceClient().

DROP POLICY IF EXISTS "Public read suggestions" ON suggestions;
