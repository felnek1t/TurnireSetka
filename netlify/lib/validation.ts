import { ALL_MATCH_IDS, sanitizeWinners } from "../../src/lib/bracket";

import { GROUP_IDS, type GroupId, type Player, type TournamentState } from "./types";

const PLAYER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const MAX_VERSION = 2_147_483_647;
const MAX_WINNERS = 64;
const KNOWN_MATCH_IDS = new Set(ALL_MATCH_IDS);

export class ValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("Некорректное состояние турнира");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function parsePlayer(
  value: unknown,
  index: number,
  issues: string[],
): Player | null {
  const path = `players[${index}]`;

  if (!isRecord(value)) {
    issues.push(`${path}: ожидается объект`);
    return null;
  }

  if (!hasOnlyKeys(value, ["id", "name", "seed", "group"])) {
    issues.push(`${path}: содержит неизвестные поля`);
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const seed = value.seed;
  const group = value.group;

  if (!PLAYER_ID_PATTERN.test(id)) {
    issues.push(`${path}.id: допустимы 1–40 латинских букв, цифр, - и _`);
  }

  if (name.length < 1 || name.length > 40) {
    issues.push(`${path}.name: длина должна быть от 1 до 40 символов`);
  }

  if (!Number.isInteger(seed) || (seed as number) < 1 || (seed as number) > 16) {
    issues.push(`${path}.seed: ожидается целое число от 1 до 16`);
  }

  if (!GROUP_IDS.includes(group as GroupId)) {
    issues.push(`${path}.group: ожидается A, B, C или D`);
  }

  if (
    !PLAYER_ID_PATTERN.test(id) ||
    name.length < 1 ||
    name.length > 40 ||
    !Number.isInteger(seed) ||
    (seed as number) < 1 ||
    (seed as number) > 16 ||
    !GROUP_IDS.includes(group as GroupId)
  ) {
    return null;
  }

  return {
    id,
    name,
    seed: seed as number,
    group: group as GroupId,
  };
}

export function validateTournamentState(value: unknown): TournamentState {
  const issues: string[] = [];

  if (!isRecord(value)) {
    throw new ValidationError(["state: ожидается объект"]);
  }

  if (!hasOnlyKeys(value, ["version", "title", "players", "winners", "updatedAt"])) {
    issues.push("state: содержит неизвестные поля");
  }

  const version = value.version;
  if (
    !Number.isInteger(version) ||
    (version as number) < 1 ||
    (version as number) > MAX_VERSION
  ) {
    issues.push(`version: ожидается целое число от 1 до ${MAX_VERSION}`);
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (title.length < 1 || title.length > 120) {
    issues.push("title: длина должна быть от 1 до 120 символов");
  }

  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  const updatedAtMillis = Date.parse(updatedAt);
  if (
    updatedAt.length > 64 ||
    !Number.isFinite(updatedAtMillis) ||
    new Date(updatedAtMillis).toISOString() !== updatedAt
  ) {
    issues.push("updatedAt: ожидается дата в ISO 8601");
  }

  const rawPlayers = Array.isArray(value.players) ? value.players : [];
  if (!Array.isArray(value.players) || rawPlayers.length !== 16) {
    issues.push("players: ожидается ровно 16 игроков");
  }

  const players = rawPlayers
    .map((player, index) => parsePlayer(player, index, issues))
    .filter((player): player is Player => player !== null);

  const playersByNormalizedId = new Map<string, Player>();
  for (const player of players) {
    const normalizedId = player.id.toLocaleLowerCase("en-US");
    if (playersByNormalizedId.has(normalizedId)) {
      issues.push(`players: повторяющийся id "${player.id}"`);
    }
    playersByNormalizedId.set(normalizedId, player);
  }

  for (const group of GROUP_IDS) {
    const groupPlayers = players.filter((player) => player.group === group);
    if (groupPlayers.length !== 4) {
      issues.push(`players: в группе ${group} должно быть ровно 4 игрока`);
    }
  }

  const seeds = new Set(players.map((player) => player.seed));
  if (seeds.size !== 16 || !Array.from({ length: 16 }, (_, index) => index + 1).every(
    (seed) => seeds.has(seed),
  )) {
    issues.push("players: seed должны быть уникальными числами от 1 до 16");
  }

  const winners: Record<string, string> = {};
  if (!isRecord(value.winners)) {
    issues.push("winners: ожидается объект");
  } else {
    const winnerEntries = Object.entries(value.winners);
    if (winnerEntries.length > MAX_WINNERS) {
      issues.push(`winners: допускается не более ${MAX_WINNERS} результатов`);
    }

    for (const [matchId, winnerIdValue] of winnerEntries) {
      if (!MATCH_ID_PATTERN.test(matchId)) {
        issues.push(`winners.${matchId}: некорректный id матча`);
        continue;
      }

      if (!KNOWN_MATCH_IDS.has(matchId)) {
        issues.push(`winners.${matchId}: матч не найден`);
        continue;
      }

      if (typeof winnerIdValue !== "string") {
        issues.push(`winners.${matchId}: id победителя должен быть строкой`);
        continue;
      }

      const winnerId = winnerIdValue.trim();
      const winner = playersByNormalizedId.get(
        winnerId.toLocaleLowerCase("en-US"),
      );
      if (!winner) {
        issues.push(`winners.${matchId}: игрок "${winnerId}" не найден`);
        continue;
      }

      winners[matchId] = winner.id;
    }
  }

  if (issues.length === 0) {
    const candidate: TournamentState = {
      version: version as number,
      title,
      players,
      winners,
      updatedAt,
    };
    const sanitizedWinners = sanitizeWinners(candidate);
    const winnerEntries = Object.entries(winners);
    const winnersAreValid =
      Object.keys(sanitizedWinners).length === winnerEntries.length &&
      winnerEntries.every(
        ([matchId, winnerId]) => sanitizedWinners[matchId] === winnerId,
      );

    if (!winnersAreValid) {
      issues.push(
        "winners: победитель должен быть участником готового матча; сначала заполните предыдущие матчи",
      );
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return {
    version: version as number,
    title,
    players,
    winners,
    updatedAt,
  };
}

export function parseExpectedVersion(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) >= MAX_VERSION
  ) {
    throw new ValidationError([
      `expectedVersion: ожидается целое число от 1 до ${MAX_VERSION - 1}`,
    ]);
  }

  return value as number;
}
