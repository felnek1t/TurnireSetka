import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

import { createDefaultState } from "./default-state";
import type {
  StoredTournamentState,
  TournamentState,
  VoteBallot,
  VoteSummary,
} from "./types";
import { ValidationError, validateTournamentState } from "./validation";

const STORE_NAME = "cs2-friends-tournament";
const STATE_KEY = "tournament/state";
const BALLOT_PREFIX = "ballots/";

function tournamentStore() {
  return getStore({
    name: STORE_NAME,
    consistency: "strong",
  });
}

function validateStoredState(value: unknown): TournamentState {
  try {
    return validateTournamentState(value);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("Invalid persisted tournament state", error.issues);
      throw new Error("Persisted tournament state is invalid");
    }
    throw error;
  }
}

export async function getTournamentState(): Promise<StoredTournamentState> {
  const store = tournamentStore();
  let entry = await store.getWithMetadata(STATE_KEY, { type: "json" });

  if (entry === null) {
    await store.setJSON(STATE_KEY, createDefaultState(), { onlyIfNew: true });
    entry = await store.getWithMetadata(STATE_KEY, { type: "json" });
  }

  if (entry === null || entry.data === null) {
    throw new Error("Tournament state could not be initialized");
  }

  // Some local Netlify emulators omit the optional ETag on a data read even
  // though the metadata endpoint exposes it. Production normally includes it,
  // but resolving it explicitly keeps optimistic locking identical in both
  // environments.
  const etag =
    entry.etag ??
    (await store.getMetadata(STATE_KEY))?.etag ??
    (await store.list({ prefix: STATE_KEY })).blobs.find(
      (blob) => blob.key === STATE_KEY,
    )?.etag;
  if (!etag) {
    throw new Error("Tournament state ETag is unavailable");
  }

  return {
    state: validateStoredState(entry.data),
    etag,
  };
}

export async function saveTournamentState(
  state: TournamentState,
  onlyIfMatch: string,
): Promise<boolean> {
  const result = await tournamentStore().setJSON(STATE_KEY, state, {
    onlyIfMatch,
  });
  return result.modified;
}

function parseBallot(value: unknown): VoteBallot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const ballot = value as Partial<VoteBallot>;
  if (
    typeof ballot.playerId !== "string" ||
    typeof ballot.createdAt !== "string" ||
    typeof ballot.receipt !== "string"
  ) {
    return null;
  }

  return {
    playerId: ballot.playerId,
    createdAt: ballot.createdAt,
    receipt: ballot.receipt,
  };
}

export async function createBallot(
  key: string,
  playerId: string,
): Promise<boolean> {
  if (await getBallot(key)) {
    return false;
  }

  const ballot: VoteBallot = {
    playerId,
    createdAt: new Date().toISOString(),
    receipt: randomUUID(),
  };
  const result = await tournamentStore().setJSON(key, ballot, {
    onlyIfNew: true,
  });
  if (!result.modified) {
    return false;
  }

  // The post-read protects against emulators that report `modified: true`
  // even when an `onlyIfNew` write was rejected. In production the atomic
  // conditional write remains the race-condition guard.
  const stored = await getBallot(key);
  return stored?.receipt === ballot.receipt;
}

export async function getBallot(key: string): Promise<VoteBallot | null> {
  const value = await tournamentStore().get(key, { type: "json" });
  return parseBallot(value);
}

export async function getVoteSummary(
  state: TournamentState,
  currentBallotKey?: string,
): Promise<VoteSummary> {
  const store = tournamentStore();
  const { blobs } = await store.list({ prefix: BALLOT_PREFIX });
  const ballotValues = await Promise.all(
    blobs.map((blob) => store.get(blob.key, { type: "json" })),
  );
  const ballots = ballotValues
    .map(parseBallot)
    .filter((ballot): ballot is VoteBallot => ballot !== null);

  const byPlayer: Record<string, number> = Object.fromEntries(
    state.players.map((player) => [player.id, 0]),
  );

  for (const ballot of ballots) {
    if (Object.hasOwn(byPlayer, ballot.playerId)) {
      byPlayer[ballot.playerId] += 1;
    }
  }

  const currentBallot = currentBallotKey
    ? await getBallot(currentBallotKey)
    : null;

  return {
    total: Object.values(byPlayer).reduce((sum, count) => sum + count, 0),
    byPlayer,
    ...(currentBallot && Object.hasOwn(byPlayer, currentBallot.playerId)
      ? { myVote: currentBallot.playerId }
      : {}),
  };
}

export async function deleteAllBallots(): Promise<number> {
  const store = tournamentStore();
  const { blobs } = await store.list({ prefix: BALLOT_PREFIX });
  await Promise.all(blobs.map((blob) => store.delete(blob.key)));
  return blobs.length;
}
