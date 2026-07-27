import {
  ALL_MATCH_IDS,
  sanitizeTournamentState as sanitizeCoreTournamentState,
} from "../src/lib/bracket";

import {
  GROUP_IDS,
  TOURNAMENT_MAPS,
  type BracketEntrants,
  type BracketEntrantOrder,
  type BracketEntrantStage,
  type GroupId,
  type MapVetoEntry,
  type MapVetoKind,
  type MatchSettings,
  type Player,
  type TournamentMap,
  type TournamentState,
} from "./types";

const PLAYER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const MAX_VERSION = 2_147_483_647;
const MAX_WINNERS = 64;
const KNOWN_MATCH_IDS = new Set(ALL_MATCH_IDS);
const KNOWN_MAPS = new Set<string>(TOURNAMENT_MAPS);

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

  if (
    !hasOnlyKeys(value, [
      "version",
      "title",
      "players",
      "winners",
      "matchSettings",
      "mapVeto",
      "bracketEntrants",
      "updatedAt",
    ])
  ) {
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
  if (
    seeds.size !== 16 ||
    !Array.from({ length: 16 }, (_, index) => index + 1).every((seed) =>
      seeds.has(seed),
    )
  ) {
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

  const matchSettings: Record<string, MatchSettings> = {};
  if (value.matchSettings !== undefined && !isRecord(value.matchSettings)) {
    issues.push("matchSettings: ожидается объект");
  } else if (isRecord(value.matchSettings)) {
    const settingsEntries = Object.entries(value.matchSettings);
    if (settingsEntries.length > ALL_MATCH_IDS.length) {
      issues.push(
        `matchSettings: допускается не более ${ALL_MATCH_IDS.length} матчей`,
      );
    }

    for (const [matchId, rawSettings] of settingsEntries) {
      if (!MATCH_ID_PATTERN.test(matchId)) {
        issues.push(`matchSettings.${matchId}: некорректный id матча`);
        continue;
      }

      if (!KNOWN_MATCH_IDS.has(matchId)) {
        issues.push(`matchSettings.${matchId}: матч не найден`);
        continue;
      }

      if (!isRecord(rawSettings)) {
        issues.push(`matchSettings.${matchId}: ожидается объект`);
        continue;
      }

      if (!hasOnlyKeys(rawSettings, ["map", "ctPlayerId"])) {
        issues.push(`matchSettings.${matchId}: содержит неизвестные поля`);
      }

      const settings: MatchSettings = {};

      if (Object.hasOwn(rawSettings, "map")) {
        if (
          typeof rawSettings.map !== "string" ||
          !KNOWN_MAPS.has(rawSettings.map)
        ) {
          issues.push(
            `matchSettings.${matchId}.map: карта должна быть одной из ${TOURNAMENT_MAPS.join(", ")}`,
          );
        } else {
          settings.map = rawSettings.map as TournamentMap;
        }
      }

      if (Object.hasOwn(rawSettings, "ctPlayerId")) {
        if (typeof rawSettings.ctPlayerId !== "string") {
          issues.push(
            `matchSettings.${matchId}.ctPlayerId: id игрока должен быть строкой`,
          );
        } else {
          const ctPlayerId = rawSettings.ctPlayerId.trim();
          const player = playersByNormalizedId.get(
            ctPlayerId.toLocaleLowerCase("en-US"),
          );
          if (!player) {
            issues.push(
              `matchSettings.${matchId}.ctPlayerId: игрок "${ctPlayerId}" не найден`,
            );
          } else {
            settings.ctPlayerId = player.id;
          }
        }
      }

      matchSettings[matchId] = settings;
    }
  }

  const mapVeto: MapVetoEntry[] = [];
  if (value.mapVeto !== undefined && !Array.isArray(value.mapVeto)) {
    issues.push("mapVeto: ожидается массив");
  } else if (Array.isArray(value.mapVeto)) {
    if (value.mapVeto.length > TOURNAMENT_MAPS.length) {
      issues.push(
        `mapVeto: допускается не более ${TOURNAMENT_MAPS.length} решений`,
      );
    }

    const decidedMaps = new Set<TournamentMap>();
    for (const [index, rawEntry] of value.mapVeto.entries()) {
      const path = `mapVeto[${index}]`;
      if (!isRecord(rawEntry)) {
        issues.push(`${path}: ожидается объект`);
        continue;
      }

      if (!hasOnlyKeys(rawEntry, ["map", "kind"])) {
        issues.push(`${path}: содержит неизвестные поля`);
      }

      const map =
        typeof rawEntry.map === "string" && KNOWN_MAPS.has(rawEntry.map)
          ? (rawEntry.map as TournamentMap)
          : null;
      const kind =
        rawEntry.kind === "ban" || rawEntry.kind === "pick"
          ? (rawEntry.kind as MapVetoKind)
          : null;

      if (!map) {
        issues.push(
          `${path}.map: карта должна быть одной из ${TOURNAMENT_MAPS.join(", ")}`,
        );
      } else if (decidedMaps.has(map)) {
        issues.push(`${path}.map: карта "${map}" уже была выбрана`);
      }

      if (!kind) {
        issues.push(`${path}.kind: ожидается ban или pick`);
      }

      if (map && kind && !decidedMaps.has(map)) {
        decidedMaps.add(map);
        mapVeto.push({ map, kind });
      }
    }
  }

  const bracketEntrants: BracketEntrants = {};
  if (
    value.bracketEntrants !== undefined &&
    !isRecord(value.bracketEntrants)
  ) {
    issues.push("bracketEntrants: ожидается объект");
  } else if (isRecord(value.bracketEntrants)) {
    if (
      !hasOnlyKeys(value.bracketEntrants, ["last-chance", "playoff"])
    ) {
      issues.push("bracketEntrants: содержит неизвестные этапы");
    }

    for (const stage of [
      "last-chance",
      "playoff",
    ] as BracketEntrantStage[]) {
      if (!Object.hasOwn(value.bracketEntrants, stage)) {
        continue;
      }

      const rawOrder = value.bracketEntrants[stage];
      const path = `bracketEntrants.${stage}`;
      if (!Array.isArray(rawOrder) || rawOrder.length !== 4) {
        issues.push(`${path}: ожидается порядок из четырёх групп`);
        continue;
      }

      const order: GroupId[] = [];
      for (const [index, rawEntry] of rawOrder.entries()) {
        if (typeof rawEntry !== "string") {
          issues.push(`${path}[${index}]: группа должна быть строкой`);
          continue;
        }

        const entry = rawEntry.trim();
        if (GROUP_IDS.includes(entry as GroupId)) {
          order.push(entry as GroupId);
          continue;
        }

        // Compatibility with the first shuffle implementation, which stored
        // four player ids after all qualifiers were known. A player uniquely
        // identifies the stable group source that should occupy this slot.
        const player = playersByNormalizedId.get(
          entry.toLocaleLowerCase("en-US"),
        );
        if (!player) {
          issues.push(
            `${path}[${index}]: группа или игрок "${entry}" не найдены`,
          );
          continue;
        }
        order.push(player.group);
      }

      if (order.length === 4 && new Set(order).size !== 4) {
        issues.push(
          `${path}: группы A, B, C и D должны встречаться по одному разу`,
        );
      }

      if (order.length === 4 && new Set(order).size === 4) {
        bracketEntrants[stage] = order as BracketEntrantOrder;
      }
    }
  }

  if (issues.length === 0) {
    const candidate: TournamentState = {
      version: version as number,
      title,
      players,
      winners,
      matchSettings,
      mapVeto,
      bracketEntrants,
      updatedAt,
    };
    const sanitizedState = sanitizeCoreTournamentState(candidate);
    const sanitizedWinners = sanitizedState.winners;
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

    for (const [matchId, settings] of Object.entries(matchSettings)) {
      if (
        settings.ctPlayerId !== undefined &&
        sanitizedState.matchSettings[matchId]?.ctPlayerId !==
          settings.ctPlayerId
      ) {
        issues.push(
          `matchSettings.${matchId}.ctPlayerId: CT должен быть текущим участником матча`,
        );
      }
    }

    for (const stage of Object.keys(
      bracketEntrants,
    ) as BracketEntrantStage[]) {
      const requested = bracketEntrants[stage];
      const sanitized = sanitizedState.bracketEntrants[stage];
      if (
        !requested ||
        !sanitized ||
        requested.some((group, index) => sanitized[index] !== group)
      ) {
        issues.push(
          `bracketEntrants.${stage}: нужен полный порядок источников A, B, C и D`,
        );
      }
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
    matchSettings,
    mapVeto,
    bracketEntrants,
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
