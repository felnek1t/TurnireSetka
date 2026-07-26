CREATE TABLE IF NOT EXISTS tournament_state (
  id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  voter_key TEXT NOT NULL PRIMARY KEY,
  player_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  receipt TEXT NOT NULL UNIQUE
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS votes_player_id_idx ON votes (player_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 1),
  PRIMARY KEY (scope, actor_hash, window_start)
) WITHOUT ROWID;
