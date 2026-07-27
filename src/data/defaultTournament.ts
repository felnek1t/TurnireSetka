import type { Player, TournamentState } from "../types";

export const DEFAULT_TOURNAMENT_TITLE = "Турнир CS2 1x1 (16 игроков)";
export const TOURNAMENT_STATE_VERSION = 1;

export const DEFAULT_PLAYERS: readonly Player[] = [
  { id: "doshik", name: "Doshik", seed: 1, group: "A" },
  { id: "limpompo", name: "limpompo", seed: 2, group: "A" },
  { id: "dima", name: "Dima", seed: 3, group: "A" },
  { id: "max", name: "Max", seed: 4, group: "A" },

  { id: "anemoia", name: "anemoia", seed: 5, group: "B" },
  { id: "dross", name: "dross", seed: 6, group: "B" },
  { id: "n2ke", name: "n2ke", seed: 7, group: "B" },
  { id: "mosya", name: "Mosya", seed: 8, group: "B" },

  { id: "maclay", name: "maclay", seed: 9, group: "C" },
  { id: "vitas", name: "Vitas", seed: 10, group: "C" },
  { id: "shpion", name: "shpion", seed: 11, group: "C" },
  { id: "reizy", name: "Reizy", seed: 12, group: "C" },

  { id: "morty", name: "Morty", seed: 13, group: "D" },
  { id: "fe1nekit", name: "fe1nekit", seed: 14, group: "D" },
  { id: "zmeuga", name: "zmeuga", seed: 15, group: "D" },
  { id: "fil", name: "fil", seed: 16, group: "D" },
];

export function createDefaultTournament(
  updatedAt = new Date().toISOString(),
): TournamentState {
  return {
    version: TOURNAMENT_STATE_VERSION,
    title: DEFAULT_TOURNAMENT_TITLE,
    players: DEFAULT_PLAYERS.map((player) => ({ ...player })),
    winners: {},
    matchSettings: {},
    mapVeto: [],
    bracketEntrants: {},
    updatedAt,
  };
}

/**
 * A deterministic initial value is convenient for SSR, tests and localStorage
 * fallbacks. Call createDefaultTournament() when a fresh timestamp is needed.
 */
export const defaultTournament: TournamentState = createDefaultTournament(
  "2026-07-26T00:00:00.000Z",
);

export const DEFAULT_TOURNAMENT = defaultTournament;
