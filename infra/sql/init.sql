CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.inputs (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS core.observations (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_id INT NOT NULL REFERENCES core.inputs(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  score INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observations_ts ON core.observations(ts DESC);
CREATE INDEX IF NOT EXISTS idx_observations_input ON core.observations(input_id);

CREATE TABLE IF NOT EXISTS core.episodes (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_name TEXT NOT NULL,
  state TEXT NOT NULL,
  confidence INT NOT NULL,
  unknowns JSONB NOT NULL DEFAULT '[]'::jsonb,
  counters JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_episodes_ts ON core.episodes(ts DESC);

CREATE TABLE IF NOT EXISTS core.system_state (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  episodes_10m INT NOT NULL,
  avg_confidence INT NOT NULL,
  unstable BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_system_state_ts ON core.system_state(ts DESC);
