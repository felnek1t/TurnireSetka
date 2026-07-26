import { createDefaultState } from "./default-state";
import { HttpError } from "./http";
import type {
  ServerEnv,
  TournamentState,
  VoteBallot,
  VoteSummary,
} from "./types";
import { ValidationError, validateTournamentState } from "./validation";

const STATE_ID = 1;

interface TournamentStateRow {
  state_json: string;
  version: number;
  updated_at: string;
}

interface VoteRow {
  player_id: string;
  created_at: string;
  receipt: string;
}

interface VoteCountRow {
  player_id: string;
  vote_count: number;
}

interface SchemaCountRow {
  object_count: number;
}

const initializationByDatabase = new WeakMap<D1Database, Promise<void>>();

function databaseFromEnv(env: ServerEnv): D1Database {
  const database = env.DB;
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "Cloudflare D1 не привязана. Добавьте binding с именем DB.",
    );
  }
  return database;
}

function schemaStatements(database: D1Database): D1PreparedStatement[] {
  return [
    database.prepare(`
      CREATE TABLE IF NOT EXISTS tournament_state (
        id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        updated_at TEXT NOT NULL
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS votes (
        voter_key TEXT NOT NULL PRIMARY KEY,
        player_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        receipt TEXT NOT NULL UNIQUE
      ) WITHOUT ROWID
    `),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS votes_player_id_idx ON votes (player_id)",
    ),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        scope TEXT NOT NULL,
        actor_hash TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL CHECK (count >= 1),
        PRIMARY KEY (scope, actor_hash, window_start)
      ) WITHOUT ROWID
    `),
  ];
}

async function initializeDatabase(env: ServerEnv): Promise<void> {
  const database = databaseFromEnv(env);
  const initialState = createDefaultState();
  const schema = await database
    .prepare(
      `SELECT COUNT(*) AS object_count
         FROM sqlite_master
        WHERE (
          type = 'table'
          AND name IN ('tournament_state', 'votes', 'rate_limits')
        )
           OR (
             type = 'index'
             AND name = 'votes_player_id_idx'
           )`,
    )
    .first<SchemaCountRow>();

  if (Number(schema?.object_count ?? 0) !== 4) {
    await database.batch(schemaStatements(database));
  }

  const existingState = await database
    .prepare("SELECT id FROM tournament_state WHERE id = ?1 LIMIT 1")
    .bind(STATE_ID)
    .first<{ id: number }>();
  if (existingState) {
    return;
  }

  await database.prepare(
    `INSERT INTO tournament_state
       (id, state_json, version, updated_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO NOTHING`,
  )
    .bind(
      STATE_ID,
      JSON.stringify(initialState),
      initialState.version,
      initialState.updatedAt,
    )
    .run();
}

/**
 * Creates the migration schema and the singleton default state if the bound D1
 * database is completely empty. Every statement is idempotent, and the
 * singleton insert is guarded by the primary key, so concurrent first requests
 * cannot overwrite one another.
 */
export async function initializeStorage(env: ServerEnv): Promise<void> {
  const database = databaseFromEnv(env);
  const existing = initializationByDatabase.get(database);
  if (existing) {
    return existing;
  }

  let initialization: Promise<void>;
  initialization = initializeDatabase(env).catch((error: unknown) => {
    if (initializationByDatabase.get(database) === initialization) {
      initializationByDatabase.delete(database);
    }
    throw error;
  });
  initializationByDatabase.set(database, initialization);
  return initialization;
}

function validateStoredState(row: TournamentStateRow): TournamentState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.state_json) as unknown;
  } catch {
    throw new Error("Persisted tournament state is not valid JSON");
  }

  let state: TournamentState;
  try {
    state = validateTournamentState(parsed);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("Invalid persisted tournament state", error.issues);
      throw new Error("Persisted tournament state is invalid");
    }
    throw error;
  }

  if (state.version !== row.version || state.updatedAt !== row.updated_at) {
    throw new Error("Persisted tournament state metadata is inconsistent");
  }

  return state;
}

export async function getTournamentState(
  env: ServerEnv,
): Promise<{ state: TournamentState }> {
  await initializeStorage(env);

  const row = await env.DB.prepare(
    `SELECT state_json, version, updated_at
       FROM tournament_state
      WHERE id = ?1
      LIMIT 1`,
  )
    .bind(STATE_ID)
    .first<TournamentStateRow>();

  if (!row) {
    throw new Error("Tournament state could not be initialized");
  }

  return { state: validateStoredState(row) };
}

/**
 * Atomically replaces the singleton state only when its persisted version is
 * still the version observed by the organizer.
 */
export async function saveTournamentState(
  env: ServerEnv,
  state: TournamentState,
  expectedVersion: number,
): Promise<boolean> {
  await initializeStorage(env);

  const result = await env.DB.prepare(
    `UPDATE tournament_state
        SET state_json = ?1,
            version = ?2,
            updated_at = ?3
      WHERE id = ?4
        AND version = ?5`,
  )
    .bind(
      JSON.stringify(state),
      state.version,
      state.updatedAt,
      STATE_ID,
      expectedVersion,
    )
    .run();

  return result.meta.changes === 1;
}

export async function createBallot(
  env: ServerEnv,
  voterKey: string,
  playerId: string,
): Promise<boolean> {
  await initializeStorage(env);

  const ballot: VoteBallot = {
    playerId,
    createdAt: new Date().toISOString(),
    receipt: crypto.randomUUID(),
  };
  const result = await env.DB.prepare(
    `INSERT INTO votes (voter_key, player_id, created_at, receipt)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(voter_key) DO NOTHING`,
  )
    .bind(voterKey, ballot.playerId, ballot.createdAt, ballot.receipt)
    .run();

  return result.meta.changes === 1;
}

export async function getBallot(
  env: ServerEnv,
  voterKey: string,
): Promise<VoteBallot | null> {
  await initializeStorage(env);

  const row = await env.DB.prepare(
    `SELECT player_id, created_at, receipt
       FROM votes
      WHERE voter_key = ?1
      LIMIT 1`,
  )
    .bind(voterKey)
    .first<VoteRow>();

  return row
    ? {
        playerId: row.player_id,
        createdAt: row.created_at,
        receipt: row.receipt,
      }
    : null;
}

export async function getVoteSummary(
  env: ServerEnv,
  state: TournamentState,
  currentVoterKey?: string,
): Promise<VoteSummary> {
  await initializeStorage(env);

  const [countResult, currentBallot] = await Promise.all([
    env.DB.prepare(
      `SELECT player_id, COUNT(*) AS vote_count
         FROM votes
        GROUP BY player_id`,
    ).all<VoteCountRow>(),
    currentVoterKey
      ? getBallot(env, currentVoterKey)
      : Promise.resolve<VoteBallot | null>(null),
  ]);

  const byPlayer: Record<string, number> = Object.fromEntries(
    state.players.map((player) => [player.id, 0]),
  );

  for (const row of countResult.results) {
    if (Object.hasOwn(byPlayer, row.player_id)) {
      byPlayer[row.player_id] = Number(row.vote_count);
    }
  }

  return {
    total: Object.values(byPlayer).reduce((sum, count) => sum + count, 0),
    byPlayer,
    ...(currentBallot && Object.hasOwn(byPlayer, currentBallot.playerId)
      ? { myVote: currentBallot.playerId }
      : {}),
  };
}

export async function deleteAllBallots(env: ServerEnv): Promise<number> {
  await initializeStorage(env);
  const result = await env.DB.prepare("DELETE FROM votes").run();
  return result.meta.changes ?? 0;
}
