import type {
  GroupId,
  GroupStanding,
  MatchDefinition,
  MatchDestination,
  ParticipantSource,
  Player,
  PlayerDropTarget,
  ResolvedMatch,
  TournamentPlacement,
  TournamentProgress,
  TournamentSnapshot,
  TournamentStage,
  TournamentState,
} from "../types";

export const GROUP_IDS: readonly GroupId[] = ["A", "B", "C", "D"];

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

  for (const definition of MATCH_DEFINITIONS) {
    const participants = definition.sources.map((source) =>
      sourcePlayerFromEvaluation(source, playersById, matchesById),
    ) as [Player | null, Player | null];

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

export function sanitizeTournamentState(
  state: TournamentState,
  updatedAt = state.updatedAt,
): TournamentState {
  return {
    ...state,
    winners: sanitizeWinners(state),
    updatedAt,
  };
}

/**
 * Selects (or clears with null) a match winner and immutably removes every
 * downstream choice that is no longer possible after the change.
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

  return sanitizeTournamentState(
    {
      ...cleanState,
      winners,
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

export function resolveTournament(
  state: TournamentState,
): TournamentSnapshot {
  const evaluation = evaluateTournament(state);
  const sanitizedState: TournamentState = {
    ...state,
    winners: evaluation.winners,
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
    progress: progressFromMatches(evaluation.matches),
  };
}

export const buildTournamentSnapshot = resolveTournament;
