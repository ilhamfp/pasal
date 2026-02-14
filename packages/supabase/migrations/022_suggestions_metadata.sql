-- Migration 022: Add metadata JSONB column to suggestions for tracking correction UX data
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
