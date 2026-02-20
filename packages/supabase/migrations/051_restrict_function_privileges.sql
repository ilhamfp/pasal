-- Migration 051: Restrict execute privileges on mutation/admin functions
-- apply_revision() and claim_jobs() should only be callable by service_role,
-- not by anon or authenticated users via the PostgREST API.

-- apply_revision: content mutation function (migration 020, updated in 038)
REVOKE EXECUTE ON FUNCTION apply_revision(integer, integer, text, varchar, text, bigint, varchar, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_revision(integer, integer, text, varchar, text, bigint, varchar, uuid) TO service_role;

-- claim_jobs: scraper job claiming function (migration 028, updated in 032)
REVOKE EXECUTE ON FUNCTION claim_jobs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_jobs(int) TO service_role;
