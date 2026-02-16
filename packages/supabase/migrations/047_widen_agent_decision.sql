-- Migration 047: Widen agent_decision column
-- "accept_with_corrections" is 26 chars, exceeds VARCHAR(20)
ALTER TABLE suggestions ALTER COLUMN agent_decision TYPE VARCHAR(30);
