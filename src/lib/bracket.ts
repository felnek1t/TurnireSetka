import type {
  BracketEntrants,
  BracketEntrantOrder,
  BracketEntrantSlot,
  BracketEntrantStage,
  GroupId,
  GroupStanding,
  MatchDefinition,
  MatchDestination,
  MatchSettings,
  ParticipantSource,
  Player,
  PlayerDropTarget,
  ResolvedMatch,
  TournamentMap,
  TournamentPlacement,
  TournamentPlacementBand,
  TournamentProgress,
  TournamentSnapshot,
  TournamentStage,
  TournamentState,
} from "../types";

export const GROUP_IDS: readonly GroupId[] = ["A", "B", "C", "D"];

export const TOURNAMENT_MAPS: readonly TournamentMap[] = [
  "de_dust2",
  "de_mirage",
  "de_overpass",
  "de_inferno",
  "de_nuke",
  "de_train",
];

export interface GroupMatchIds {
  opening1: string;
  opening2: string;
  winners: string;
  losers: string;
  decider: string;
}

function createGroupMatchIds(group: GroupId): GroupMatchIds {
  const prefix = `group-${group.toLowerCase()}`;

  return {
    opening1: `${prefix}-opening-1`,
    opening2: `${prefix}-opening-2`,
    winners: `${prefix}-winners`,
    losers: `${prefix}-losers`,
    decider: `${prefix}-decider`,
  };
}

export const GROUP_MATCH_IDS: Readonly<Record<GroupId, GroupMatchIds>> = {
  A: createGroupMatchIds("A"),
  B: createGroupMatchIds("B"),
  C: createGroupMatchIds("C"),
  D: createGroupMatchIds("D"),
};

export const BRACKET_MATCH_IDS = {
  lastChanceSemi1: "last-chance-semi-1",
  lastChanceSemi2: "last-chance-semi-2",
  lastChanceFinal: "last-chance-final",
  playoffQuarter1: "playoff-quarter-1",
  playoffQuarter2: "playoff-quarter-2",
  upperFinal: "playoff-upper-final",
  lowerFinal: "playoff-lower-final",
  grandFinal: "grand-final",
} as const;

export const BRACKET_ENTRANT_SLOTS: Readonly<
  Record<BracketEntrantStage, readonly BracketEntrantSlot[]>
> = {
  "last-chance": [
    {
      stage: "last-chance",
      matchId: BRACKET_MATCH_IDS.lastChanceSemi1,
      slot: 0,
    },
    {
      stage: "last-chance",
      matchId: BRACKET_MATCH_IDS.lastChanceSemi1,
      slot: 1,
    },
    {
      stage: "last-chance",
      matchId: BRACKET_MATCH_IDS.lastChanceSemi2,
      slot: 0,
    },
    {
      stage: "last-chance",
      matchId: BRACKET_MATCH_IDS.lastChanceSemi2,
      slot: 1,
    },
  ],
  playoff: [
    {
      stage: "playoff",
      matchId: BRACKET_MATCH_IDS.playoffQuarter1,
      slot: 0,
    },
    {
      stage: "playoff",
      matchId: BRACKET_MATCH_IDS.playoffQuarter1,
      slot: 1,
    },
    {
      stage: "playoff",
      matchId: BRACKET_MATCH_IDS.playoffQuarter2,
      slot: 0,
    },
    {
      stage: "playoff",
      matchId: BRACKET_MATCH_IDS.playoffQuarter2,
      slot: 1,
    },
  ],
};

const BRACKET_ENTRANT_DROP_PREFIX = "bracket-entrant-slot::";

export function getBracketEntrantDropId(
  matchId: string,
  slot: 0 | 1,
): string {
  return `${BRACKET_ENTRANT_DROP_PREFIX}${matchId}::${slot}`;
}

export function parseBracketEntrantDropId(
  value: string,
): { matchId: string; slot: 0 | 1 } | null {
  if (!value.startsWith(BRACKET_ENTRANT_DROP_PREFIX)) {
    return null;
  }

  const match = value
    .slice(BRACKET_ENTRANT_DROP_PREFIX.length)
    .match(/^(.+)::([01])$/);
  if (!match) {
    return null;
  }

  return {
    matchId: match[1],
    slot: Number(match[2]) as 0 | 1,
  };
}

const seed = (playerId: string): ParticipantSource => ({
  type: "seed",
  playerId,
});

const winner = (matchId: string): ParticipantSource => ({
  type: "winner",
  matchId,
});

const loser = (matchId: string): ParticipantSource => ({
  type: "loser",
  matchId,
});

let nextMatchOrder = 0;

function defineMatch(
  definition: Omit<MatchDefinition, "order">,
): MatchDefinition {
  nextMatchOrder += 1;
  return { ...definition, order: nextMatchOrder };
}

function createGroupMatches(group: GroupId): MatchDefinition[] {
  const ids = GROUP_MATCH_IDS[group];
  const playerIds = {
    A: ["doshik", "limpompo", "dima", "max"],
    B: ["anemoia", "dross", "n2ke", "mosya"],
    C: ["maclay", "vitas", "shpion", "reizy"],
    D: ["morty", "fe1nekit", "zmeuga", "fil"],
  }[group];

  return [
    defineMatch({
      id: ids.opening1,
      stage: "group",
      round: 1,
      group,
      label: `Группа ${group} · Матч 1`,
      bestOf: 1,
      sources: [seed(playerIds[0]), seed(playerIds[1])],
    }),
    defineMatch({
      id: ids.opening2,
      stage: "group",
      round: 1,
      group,
      label: `Группа ${group} · Матч 2`,
      bestOf: 1,
      sources: [seed(playerIds[2]), seed(playerIds[3])],
    }),
    defineMatch({
      id: ids.winners,
      stage: "group",
      round: 2,
      group,
      label: `Группа ${group} · Матч победителей`,
      bestOf: 1,
      sources: [winner(ids.opening1), winner(ids.opening2)],
    }),
    defineMatch({
      id: ids.losers,
      stage: "group",
      round: 2,
      group,
      label: `Группа ${group} · Матч проигравших`,
      bestOf: 1,
      sources: [loser(ids.opening1), loser(ids.opening2)],
    }),
    defineMatch({
      id: ids.decider,
      stage: "group",
      round: 3,
      group,
      label: `Группа ${group} · Решающий матч`,
      bestOf: 1,
      sources: [loser(ids.winners), winner(ids.losers)],
    }),
  ];
}

const groupMatches = GROUP_IDS.flatMap(createGroupMatches);

export const MATCH_DEFINITIONS: readonly MatchDefinition[] = [
  ...groupMatches,
  defineMatch({
    id: BRACKET_MATCH_IDS.lastChanceSemi1,
    stage: "last-chance",
    round: 1,
    label: "Последний шанс · Полуфинал A/B",
    bestOf: 1,
    sources: [
      winner(GROUP_MATCH_IDS.A.decider),
      winner(GROUP_MATCH_IDS.B.decider),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.lastChanceSemi2,
    stage: "last-chance",
    round: 1,
    label: "Последний шанс · Полуфинал C/D",
    bestOf: 1,
    sources: [
      winner(GROUP_MATCH_IDS.C.decider),
      winner(GROUP_MATCH_IDS.D.decider),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.lastChanceFinal,
    stage: "last-chance",
    round: 2,
    label: "Последний шанс · Финал",
    bestOf: 1,
    sources: [
      winner(BRACKET_MATCH_IDS.lastChanceSemi1),
      winner(BRACKET_MATCH_IDS.lastChanceSemi2),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.playoffQuarter1,
    stage: "playoff",
    round: 1,
    label: "Плей-офф · Четвертьфинал A/B",
    bestOf: 3,
    sources: [
      winner(GROUP_MATCH_IDS.A.winners),
      winner(GROUP_MATCH_IDS.B.winners),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.playoffQuarter2,
    stage: "playoff",
    round: 1,
    label: "Плей-офф · Четвертьфинал C/D",
    bestOf: 3,
    sources: [
      winner(GROUP_MATCH_IDS.C.winners),
      winner(GROUP_MATCH_IDS.D.winners),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.upperFinal,
    stage: "playoff",
    round: 2,
    label: "Плей-офф · Верхний финал",
    bestOf: 3,
    sources: [
      winner(BRACKET_MATCH_IDS.playoffQuarter1),
      winner(BRACKET_MATCH_IDS.playoffQuarter2),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.lowerFinal,
    stage: "playoff",
    round: 3,
    label: "Плей-офф · Нижний финал",
    bestOf: 3,
    sources: [
      winner(BRACKET_MATCH_IDS.lastChanceFinal),
      loser(BRACKET_MATCH_IDS.upperFinal),
    ],
  }),
  defineMatch({
    id: BRACKET_MATCH_IDS.grandFinal,
    stage: "playoff",
    round: 4,
    label: "Гранд-финал",
    bestOf: 3,
    sources: [
      winner(BRACKET_MATCH_IDS.upperFinal),
      winner(BRACKET_MATCH_IDS.lowerFinal),
    ],
  }),
];

export const ALL_MATCH_IDS: readonly string[] = MATCH_DEFINITIONS.map(
  ({ id }) => id,
);

const matchDefinitionsById = new Map(
  MATCH_DEFINITIONS.map((definition) => [definition.id, definition]),
);

interface BracketEntrantSlotInfo extends BracketEntrantSlot {
  index: number;
}

const bracketEntrantSlotLookup = new Map<string, BracketEntrantSlotInfo>(
  Object.values(BRACKET_ENTRANT_SLOTS).flatMap((slots) =>
    slots.map((slot, index) => [
      getBracketEntrantDropId(slot.matchId, slot.slot),
      { ...slot, index },
    ]),
  ),
);

function getBracketEntrantSlotInfo(
  matchId: string,
  slot: 0 | 1,
): BracketEntrantSlotInfo | null {
  return (
    bracketEntrantSlotLookup.get(getBracketEntrantDropId(matchId, slot)) ??
    null
  );
}

export function isBracketEntrantSlot(
  matchId: string,
  slot: 0 | 1,
  stage?: BracketEntrantStage,
): boolean {
  const info = getBracketEntrantSlotInfo(matchId, slot);
  return Boolean(info && (stage === undefined || info.stage === stage));
}

interface Evaluation {
  matches: ResolvedMatch[];
  matchesById: Map<string, ResolvedMatch>;
  winners: Record<string, string>;
}

function sourcePlayerFromEvaluation(
  source: ParticipantSource,
  playersById: Map<string, Player>,
  matchesById: Map<string, ResolvedMatch>,
): Player | null {
  if (source.type === "seed") {
    return playersById.get(source.playerId) ?? null;
  }

  const sourceMatch = matchesById.get(source.matchId);
  return source.type === "winner"
    ? sourceMatch?.winner ?? null
    : sourceMatch?.loser ?? null;
}

function defaultBracketEntrants(
  stage: BracketEntrantStage,
  playersById: Map<string, Player>,
  matchesById: Map<string, ResolvedMatch>,
): [Player | null, Player | null, Player | null, Player | null] {
  return BRACKET_ENTRANT_SLOTS[stage].map(({ matchId, slot }) => {
    const definition = matchDefinitionsById.get(matchId);
    return definition
      ? sourcePlayerFromEvaluation(
          definition.sources[slot],
          playersById,
          matchesById,
        )
      : null;
  }) as [Player | null, Player | null, Player | null, Player | null];
}

function validBracketEntrantOrder(
  value: unknown,
  defaultPlayers: readonly (Player | null)[],
): BracketEntrantOrder | null {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((playerId) => typeof playerId === "string") ||
    defaultPlayers.some((player) => player === null)
  ) {
    return null;
  }

  const order = value as string[];
  const uniqueOrder = new Set(order);
  const defaultIds = defaultPlayers.map((player) => player!.id);
  if (
    uniqueOrder.size !== 4 ||
    defaultIds.some((playerId) => !uniqueOrder.has(playerId))
  ) {
    return null;
  }

  return [...order] as BracketEntrantOrder;
}

function resolvedBracketEntrants(
  state: TournamentState,
  stage: BracketEntrantStage,
  playersById: Map<string, Player>,
  matchesById: Map<string, ResolvedMatch>,
): [Player | null, Player | null, Player | null, Player | null] {
  const defaults = defaultBracketEntrants(stage, playersById, matchesById);
  const order = validBracketEntrantOrder(
    state.bracketEntrants?.[stage],
    defaults,
  );

  if (!order) {
    return defaults;
  }

  return order.map((playerId) => playersById.get(playerId) ?? null) as [
    Player | null,
    Player | null,
    Player | null,
    Player | null,
  ];
}

/**
 * Resolves every match in topological order. This is also the single source of
 * truth for winner validation: an entry is accepted only when both competitors
 * are known and the selected id belongs to one of them.
 */
function evaluateTournament(state: TournamentState): Evaluation {
  const playersById = new Map(
    state.players.map((player) => [player.id, player] as const),
  );
  const matches: ResolvedMatch[] = [];
  const matchesById = new Map<string, ResolvedMatch>();
  const sanitizedWinners: Record<string, string> = {};
  const entrantPlayersByStage = new Map<
    BracketEntrantStage,
    [Player | null, Player | null, Player | null, Player | null]
  >();

  for (const definition of MATCH_DEFINITIONS) {
    const participants = definition.sources.map((source, slot) => {
      const entrantSlot = getBracketEntrantSlotInfo(
        definition.id,
        slot as 0 | 1,
      );
      if (!entrantSlot) {
        return sourcePlayerFromEvaluation(source, playersById, matchesById);
      }

      let entrants = entrantPlayersByStage.get(entrantSlot.stage);
      if (!entrants) {
        entrants = resolvedBracketEntrants(
          state,
          entrantSlot.stage,
          playersById,
          matchesById,
        );
        entrantPlayersByStage.set(entrantSlot.stage, entrants);
      }
      return entrants[entrantSlot.index];
    }) as [Player | null, Player | null];

    const hasValidPair =
      participants[0] !== null &&
      participants[1] !== null &&
      participants[0].id !== participants[1].id;
    const selectedWinnerId = state.winners[definition.id];
    const winnerIsValid =
      hasValidPair &&
      participants.some((participant) => participant?.id === selectedWinnerId);
    const winnerPlayer = winnerIsValid
      ? participants.find(
          (participant) => participant?.id === selectedWinnerId,
        ) ?? null
      : null;
    const loserPlayer = winnerPlayer
      ? participants.find(
          (participant) => participant?.id !== winnerPlayer.id,
        ) ?? null
      : null;

    if (winnerPlayer) {
      sanitizedWinners[definition.id] = winnerPlayer.id;
    }

    const resolvedMatch: ResolvedMatch = {
      ...definition,
      participants,
      winnerId: winnerPlayer?.id ?? null,
      loserId: loserPlayer?.id ?? null,
      winner: winnerPlayer,
      loser: loserPlayer,
      status: winnerPlayer ? "complete" : hasValidPair ? "ready" : "locked",
    };

    matches.push(resolvedMatch);
    matchesById.set(definition.id, resolvedMatch);
  }

  return {
    matches,
    matchesById,
    winners: sanitizedWinners,
  };
}

export function getMatchDefinition(
  matchId: string,
): MatchDefinition | null {
  return matchDefinitionsById.get(matchId) ?? null;
}

export const getMatch = getMatchDefinition;

export function getResolvedMatches(state: TournamentState): ResolvedMatch[] {
  return evaluateTournament(state).matches;
}

export function getResolvedMatch(
  state: TournamentState,
  matchId: string,
): ResolvedMatch | null {
  return evaluateTournament(state).matchesById.get(matchId) ?? null;
}

export function getMatchParticipants(
  state: TournamentState,
  matchId: string,
): readonly [Player | null, Player | null] {
  return getResolvedMatch(state, matchId)?.participants ?? [null, null];
}

export function resolveParticipantSource(
  state: TournamentState,
  source: ParticipantSource,
): Player | null {
  const evaluation = evaluateTournament(state);
  const playersById = new Map(
    state.players.map((player) => [player.id, player] as const),
  );

  return sourcePlayerFromEvaluation(
    source,
    playersById,
    evaluation.matchesById,
  );
}

export function sanitizeWinners(
  state: TournamentState,
): Record<string, string> {
  return evaluateTournament(state).winners;
}

function isTournamentMap(value: unknown): value is TournamentMap {
  return TOURNAMENT_MAPS.some((map) => map === value);
}

function sanitizeMatchSettingsFromEvaluation(
  state: TournamentState,
  evaluation: Evaluation,
): Record<string, MatchSettings> {
  const sanitizedSettings: Record<string, MatchSettings> = {};
  const sourceSettings = state.matchSettings ?? {};

  for (const definition of MATCH_DEFINITIONS) {
    const settings = sourceSettings[definition.id];
    if (!settings) {
      continue;
    }

    const match = evaluation.matchesById.get(definition.id);
    const sanitized: MatchSettings = {};

    if (isTournamentMap(settings.map)) {
      sanitized.map = settings.map;
    }

    if (
      match &&
      match.status !== "locked" &&
      match.participants.some(
        (participant) => participant?.id === settings.ctPlayerId,
      )
    ) {
      sanitized.ctPlayerId = settings.ctPlayerId;
    }

    if (sanitized.map !== undefined || sanitized.ctPlayerId !== undefined) {
      sanitizedSettings[definition.id] = sanitized;
    }
  }

  return sanitizedSettings;
}

function sanitizeBracketEntrantsFromEvaluation(
  state: TournamentState,
  evaluation: Evaluation,
): BracketEntrants {
  const sanitized: BracketEntrants = {};
  const playersById = new Map(
    state.players.map((player) => [player.id, player] as const),
  );

  for (const stage of Object.keys(
    BRACKET_ENTRANT_SLOTS,
  ) as BracketEntrantStage[]) {
    const defaults = defaultBracketEntrants(
      stage,
      playersById,
      evaluation.matchesById,
    );
    const order = validBracketEntrantOrder(
      state.bracketEntrants?.[stage],
      defaults,
    );
    if (order) {
      sanitized[stage] = order;
    }
  }

  return sanitized;
}

export function getMatchSettings(
  state: TournamentState,
  matchId: string,
): MatchSettings {
  if (!matchDefinitionsById.has(matchId)) {
    throw new RangeError(`Unknown match: ${matchId}`);
  }

  const evaluation = evaluateTournament(state);
  return {
    ...sanitizeMatchSettingsFromEvaluation(state, evaluation)[matchId],
  };
}

export function sanitizeTournamentState(
  state: TournamentState,
  updatedAt = state.updatedAt,
): TournamentState {
  const evaluation = evaluateTournament(state);

  return {
    ...state,
    winners: evaluation.winners,
    matchSettings: sanitizeMatchSettingsFromEvaluation(state, evaluation),
    bracketEntrants: sanitizeBracketEntrantsFromEvaluation(state, evaluation),
    updatedAt,
  };
}

export function setMatchMap(
  state: TournamentState,
  matchId: string,
  map: TournamentMap | null,
  updatedAt = new Date().toISOString(),
): TournamentState {
  if (!matchDefinitionsById.has(matchId)) {
    throw new RangeError(`Unknown match: ${matchId}`);
  }
  if (map !== null && !isTournamentMap(map)) {
    throw new RangeError(`Unknown tournament map: ${map}`);
  }

  const cleanState = sanitizeTournamentState(state);
  const currentSettings = cleanState.matchSettings[matchId] ?? {};
  const matchSettings = { ...cleanState.matchSettings };

  if (map === null) {
    const { map: _removedMap, ...remainingSettings } = currentSettings;
    if (remainingSettings.ctPlayerId === undefined) {
      delete matchSettings[matchId];
    } else {
      matchSettings[matchId] = remainingSettings;
    }
  } else {
    matchSettings[matchId] = {
      ...currentSettings,
      map,
    };
  }

  return {
    ...cleanState,
    matchSettings,
    updatedAt,
  };
}

export function setMatchCtPlayer(
  state: TournamentState,
  matchId: string,
  playerId: string | null,
  updatedAt = new Date().toISOString(),
): TournamentState {
  if (!matchDefinitionsById.has(matchId)) {
    throw new RangeError(`Unknown match: ${matchId}`);
  }

  const cleanState = sanitizeTournamentState(state);
  const match = getResolvedMatch(cleanState, matchId);

  if (playerId !== null) {
    if (!match || match.status === "locked") {
      throw new RangeError(`Match is not ready: ${matchId}`);
    }
    if (!match.participants.some((player) => player?.id === playerId)) {
      throw new RangeError(
        `Player ${playerId} is not a participant of match ${matchId}`,
      );
    }
  }

  const currentSettings = cleanState.matchSettings[matchId] ?? {};
  const matchSettings = { ...cleanState.matchSettings };

  if (playerId === null) {
    const { ctPlayerId: _removedCtPlayer, ...remainingSettings } =
      currentSettings;
    if (remainingSettings.map === undefined) {
      delete matchSettings[matchId];
    } else {
      matchSettings[matchId] = remainingSettings;
    }
  } else {
    matchSettings[matchId] = {
      ...currentSettings,
      ctPlayerId: playerId,
    };
  }

  return {
    ...cleanState,
    matchSettings,
    updatedAt,
  };
}

/**
 * Selects (or clears with null) a match winner and immutably removes every
 * downstream choice and CT-side assignment that is no longer possible after
 * the change.
 */
export function setMatchWinner(
  state: TournamentState,
  matchId: string,
  winnerId: string | null,
  updatedAt = new Date().toISOString(),
): TournamentState {
  if (!matchDefinitionsById.has(matchId)) {
    throw new RangeError(`Unknown match: ${matchId}`);
  }

  const cleanState = sanitizeTournamentState(state);
  const match = getResolvedMatch(cleanState, matchId);

  if (winnerId !== null) {
    if (!match || match.status === "locked") {
      throw new RangeError(`Match is not ready: ${matchId}`);
    }

    if (!match.participants.some((player) => player?.id === winnerId)) {
      throw new RangeError(
        `Player ${winnerId} is not a participant of match ${matchId}`,
      );
    }
  }

  const winners = { ...cleanState.winners };
  if (winnerId === null) {
    delete winners[matchId];
  } else {
    winners[matchId] = winnerId;
  }

  const nextEvaluation = evaluateTournament({
    ...cleanState,
    winners,
  });
  const currentEvaluation = evaluateTournament(cleanState);
  const matchSettings = { ...cleanState.matchSettings };

  for (const [configuredMatchId, settings] of Object.entries(matchSettings)) {
    if (!settings.ctPlayerId) {
      continue;
    }

    const beforeParticipants = currentEvaluation.matchesById
      .get(configuredMatchId)
      ?.participants.flatMap((participant) =>
        participant ? [participant.id] : [],
      )
      .sort();
    const afterParticipants = nextEvaluation.matchesById
      .get(configuredMatchId)
      ?.participants.flatMap((participant) =>
        participant ? [participant.id] : [],
      )
      .sort();

    if (
      beforeParticipants?.length === 2 &&
      afterParticipants?.length === 2 &&
      beforeParticipants.every(
        (playerId, index) => playerId === afterParticipants[index],
      )
    ) {
      continue;
    }

    const { ctPlayerId: _removedCtPlayer, ...remainingSettings } = settings;
    if (remainingSettings.map === undefined) {
      delete matchSettings[configuredMatchId];
    } else {
      matchSettings[configuredMatchId] = remainingSettings;
    }
  }

  return sanitizeTournamentState(
    {
      ...cleanState,
      winners,
      matchSettings,
      updatedAt,
    },
    updatedAt,
  );
}

export function clearMatchWinner(
  state: TournamentState,
  matchId: string,
  updatedAt = new Date().toISOString(),
): TournamentState {
  return setMatchWinner(state, matchId, null, updatedAt);
}

export const advancePlayer = setMatchWinner;
export const chooseWinner = setMatchWinner;

function groupStandingSources(
  group: GroupId,
): readonly [
  ParticipantSource,
  ParticipantSource,
  ParticipantSource,
  ParticipantSource,
] {
  const ids = GROUP_MATCH_IDS[group];

  return [
    winner(ids.winners),
    winner(ids.decider),
    loser(ids.decider),
    loser(ids.losers),
  ];
}

export const GROUP_STANDING_SOURCES: Readonly<
  Record<
    GroupId,
    readonly [
      ParticipantSource,
      ParticipantSource,
      ParticipantSource,
      ParticipantSource,
    ]
  >
> = {
  A: groupStandingSources("A"),
  B: groupStandingSources("B"),
  C: groupStandingSources("C"),
  D: groupStandingSources("D"),
};

export function getGroupStandings(
  state: TournamentState,
  group: GroupId,
): GroupStanding[] {
  return GROUP_STANDING_SOURCES[group].map((source, index) => ({
    group,
    position: (index + 1) as 1 | 2 | 3 | 4,
    player: resolveParticipantSource(state, source),
    source,
  }));
}

export const PLACEMENT_SOURCES: readonly [
  ParticipantSource,
  ParticipantSource,
  ParticipantSource,
] = [
  winner(BRACKET_MATCH_IDS.grandFinal),
  loser(BRACKET_MATCH_IDS.grandFinal),
  loser(BRACKET_MATCH_IDS.lowerFinal),
];

export function getPlacements(
  state: TournamentState,
): TournamentPlacement[] {
  return PLACEMENT_SOURCES.map((source, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    player: resolveParticipantSource(state, source),
    source,
  }));
}

export const PLACEMENT_BAND_SOURCES: readonly {
  from: number;
  to: number;
  sources: readonly ParticipantSource[];
}[] = [
  {
    from: 4,
    to: 5,
    sources: [
      loser(BRACKET_MATCH_IDS.playoffQuarter1),
      loser(BRACKET_MATCH_IDS.playoffQuarter2),
    ],
  },
  {
    from: 6,
    to: 6,
    sources: [loser(BRACKET_MATCH_IDS.lastChanceFinal)],
  },
  {
    from: 7,
    to: 8,
    sources: [
      loser(BRACKET_MATCH_IDS.lastChanceSemi1),
      loser(BRACKET_MATCH_IDS.lastChanceSemi2),
    ],
  },
  {
    from: 9,
    to: 12,
    sources: GROUP_IDS.map((group) =>
      loser(GROUP_MATCH_IDS[group].decider),
    ),
  },
  {
    from: 13,
    to: 16,
    sources: GROUP_IDS.map((group) =>
      loser(GROUP_MATCH_IDS[group].losers),
    ),
  },
];

export function getPlacementBands(
  state: TournamentState,
): TournamentPlacementBand[] {
  return PLACEMENT_BAND_SOURCES.map(({ from, to, sources }) => ({
    from,
    to,
    entries: sources.map((source) => ({
      player: resolveParticipantSource(state, source),
      source,
    })),
  }));
}

function progressFromMatches(matches: readonly ResolvedMatch[]): TournamentProgress {
  const completed = matches.filter(({ status }) => status === "complete").length;
  const ready = matches.filter(({ status }) => status === "ready").length;
  const locked = matches.filter(({ status }) => status === "locked").length;
  const total = matches.length;

  return {
    completed,
    total,
    ready,
    locked,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    status:
      completed === total
        ? "complete"
        : completed === 0
          ? "not-started"
          : "in-progress",
  };
}

export function getTournamentProgress(
  state: TournamentState,
): TournamentProgress {
  return progressFromMatches(evaluateTournament(state).matches);
}

export function getStageProgress(
  state: TournamentState,
  stage: TournamentStage,
): TournamentProgress {
  return progressFromMatches(
    evaluateTournament(state).matches.filter(
      (match) => match.stage === stage,
    ),
  );
}

export function getTournamentStatus(
  state: TournamentState,
): TournamentProgress["status"] {
  return getTournamentProgress(state).status;
}

export const MATCH_DESTINATIONS: readonly MatchDestination[] =
  MATCH_DEFINITIONS.flatMap((definition) =>
    definition.sources.flatMap((source, slot) => {
      if (source.type === "seed") {
        return [];
      }

      return [
        {
          fromMatchId: source.matchId,
          outcome: source.type,
          toMatchId: definition.id,
          toSlot: slot as 0 | 1,
        },
      ];
    }),
  );

export function getMatchDestinations(matchId: string): MatchDestination[] {
  return MATCH_DESTINATIONS.filter(
    ({ fromMatchId }) => fromMatchId === matchId,
  );
}

function dropTargetForDestination(
  evaluation: Evaluation,
  playerId: string,
  destination: MatchDestination,
): PlayerDropTarget | null {
  const sourceMatch = evaluation.matchesById.get(destination.fromMatchId);
  if (
    !sourceMatch ||
    sourceMatch.status === "locked" ||
    !sourceMatch.participants.some((player) => player?.id === playerId)
  ) {
    return null;
  }

  const winnerId =
    destination.outcome === "winner"
      ? playerId
      : sourceMatch.participants.find((player) => player?.id !== playerId)?.id;

  if (!winnerId) {
    return null;
  }

  return {
    ...destination,
    playerId,
    winnerId,
  };
}

/**
 * Lists downstream slots into which a player's card can be dropped. Supplying
 * fromMatchId is useful when the same player is visible in several rounds.
 */
export function getPlayerDropTargets(
  state: TournamentState,
  playerId: string,
  fromMatchId?: string,
): PlayerDropTarget[] {
  if (!state.players.some((player) => player.id === playerId)) {
    return [];
  }

  const evaluation = evaluateTournament(state);

  return MATCH_DESTINATIONS.filter(
    (destination) =>
      fromMatchId === undefined || destination.fromMatchId === fromMatchId,
  )
    .map((destination) =>
      dropTargetForDestination(evaluation, playerId, destination),
    )
    .filter((target): target is PlayerDropTarget => target !== null);
}

export function resolvePlayerDropTarget(
  state: TournamentState,
  playerId: string,
  toMatchId: string,
  toSlot?: 0 | 1,
): PlayerDropTarget | null {
  const targets = getPlayerDropTargets(state, playerId).filter(
    (target) =>
      target.toMatchId === toMatchId &&
      (toSlot === undefined || target.toSlot === toSlot),
  );

  return targets.length === 1 ? targets[0] : null;
}

export const getDropTarget = resolvePlayerDropTarget;

export function applyPlayerDrop(
  state: TournamentState,
  playerId: string,
  toMatchId: string,
  toSlot?: 0 | 1,
  updatedAt = new Date().toISOString(),
): TournamentState {
  const target = resolvePlayerDropTarget(
    state,
    playerId,
    toMatchId,
    toSlot,
  );

  if (!target) {
    throw new RangeError(
      `Player ${playerId} cannot be dropped into match ${toMatchId}`,
    );
  }

  return setMatchWinner(
    state,
    target.fromMatchId,
    target.winnerId,
    updatedAt,
  );
}

function currentBracketEntrantOrder(
  state: TournamentState,
  stage: BracketEntrantStage,
): BracketEntrantOrder | null {
  const evaluation = evaluateTournament(state);
  const order = BRACKET_ENTRANT_SLOTS[stage].map(
    ({ matchId, slot }) =>
      evaluation.matchesById.get(matchId)?.participants[slot]?.id ?? null,
  );

  if (
    order.some((playerId) => playerId === null) ||
    new Set(order).size !== 4
  ) {
    return null;
  }

  return order as BracketEntrantOrder;
}

export function canShuffleBracketEntrants(
  state: TournamentState,
  stage: BracketEntrantStage,
): boolean {
  return currentBracketEntrantOrder(state, stage) !== null;
}

export function getBracketSwapTargets(
  state: TournamentState,
  fromMatchId: string,
  fromSlot: 0 | 1,
): BracketEntrantSlot[] {
  const source = getBracketEntrantSlotInfo(fromMatchId, fromSlot);
  if (!source || !currentBracketEntrantOrder(state, source.stage)) {
    return [];
  }

  return BRACKET_ENTRANT_SLOTS[source.stage]
    .filter(({ matchId }) => matchId !== fromMatchId)
    .map((slot) => ({ ...slot }));
}

function dependentMatchIds(rootMatchIds: readonly string[]): Set<string> {
  const affected = new Set(rootMatchIds);
  const queue = [...rootMatchIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const destination of MATCH_DESTINATIONS) {
      if (
        destination.fromMatchId === current &&
        !affected.has(destination.toMatchId)
      ) {
        affected.add(destination.toMatchId);
        queue.push(destination.toMatchId);
      }
    }
  }

  return affected;
}

export function swapBracketEntrants(
  state: TournamentState,
  fromMatchId: string,
  fromSlot: 0 | 1,
  toMatchId: string,
  toSlot: 0 | 1,
  updatedAt = new Date().toISOString(),
): TournamentState {
  const source = getBracketEntrantSlotInfo(fromMatchId, fromSlot);
  const target = getBracketEntrantSlotInfo(toMatchId, toSlot);
  if (
    !source ||
    !target ||
    source.stage !== target.stage ||
    source.matchId === target.matchId
  ) {
    throw new RangeError(
      "Игроков можно менять только между соседними стартовыми матчами одного этапа",
    );
  }

  const cleanState = sanitizeTournamentState(state);
  const order = currentBracketEntrantOrder(cleanState, source.stage);
  if (!order) {
    throw new RangeError(
      "Сначала определите всех четырёх участников этого этапа",
    );
  }

  const nextOrder = [...order] as BracketEntrantOrder;
  [nextOrder[source.index], nextOrder[target.index]] = [
    nextOrder[target.index],
    nextOrder[source.index],
  ];

  const affected = dependentMatchIds([
    source.matchId,
    target.matchId,
  ]);
  const winners = Object.fromEntries(
    Object.entries(cleanState.winners).filter(
      ([matchId]) => !affected.has(matchId),
    ),
  );
  const matchSettings = Object.fromEntries(
    Object.entries(cleanState.matchSettings).map(([matchId, settings]) => {
      if (!affected.has(matchId) || settings.ctPlayerId === undefined) {
        return [matchId, settings];
      }

      const { ctPlayerId: _removedCtPlayer, ...remainingSettings } = settings;
      return [matchId, remainingSettings];
    }),
  );

  return sanitizeTournamentState(
    {
      ...cleanState,
      bracketEntrants: {
        ...cleanState.bracketEntrants,
        [source.stage]: nextOrder,
      },
      winners,
      matchSettings,
      updatedAt,
    },
    updatedAt,
  );
}

export function resolveTournament(
  state: TournamentState,
): TournamentSnapshot {
  const evaluation = evaluateTournament(state);
  const sanitizedState: TournamentState = {
    ...state,
    winners: evaluation.winners,
    matchSettings: sanitizeMatchSettingsFromEvaluation(state, evaluation),
    bracketEntrants: sanitizeBracketEntrantsFromEvaluation(state, evaluation),
  };

  return {
    state: sanitizedState,
    matches: evaluation.matches,
    groups: {
      A: getGroupStandings(sanitizedState, "A"),
      B: getGroupStandings(sanitizedState, "B"),
      C: getGroupStandings(sanitizedState, "C"),
      D: getGroupStandings(sanitizedState, "D"),
    },
    placements: getPlacements(sanitizedState),
    placementBands: getPlacementBands(sanitizedState),
    progress: progressFromMatches(evaluation.matches),
  };
}

export const buildTournamentSnapshot = resolveTournament;
