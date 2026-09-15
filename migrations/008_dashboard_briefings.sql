-- Buses America - Migration 008: dashboard_briefings
--
-- Backs GET/POST /api/reports/dashboard-briefing (the Dashboard's
-- AI-generated daily briefing paragraph). Append-only log - the app always
-- reads "most recent row" and inserts a new one on each generation, rather
-- than updating in place, so past briefings stay around for free if they're
-- ever worth looking back at.
--
-- Safe to run repeatedly: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS dashboard_briefings (
    briefing_id   SERIAL PRIMARY KEY,
    content       TEXT NOT NULL,
    generated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by  VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_briefings_generated_at
    ON dashboard_briefings(generated_at DESC);
