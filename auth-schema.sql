CREATE TABLE IF NOT EXISTS auth_flows (
  state_hash TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  verifier_enc TEXT NOT NULL,
  result_enc TEXT,
  session_hash TEXT,
  error_code TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_hash TEXT PRIMARY KEY,
  refresh_enc TEXT NOT NULL,
  access_enc TEXT NOT NULL,
  access_expires INTEGER NOT NULL,
  account TEXT NOT NULL,
  display_name TEXT NOT NULL,
  expires INTEGER NOT NULL,
  refresh_lock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS auth_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_flows_expiry ON auth_flows(expires);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires);
