import type { GroupId, Player, TournamentState } from "./types";

const GROUP_PLAYERS: Readonly<Record<GroupId, readonly string[]>> = {
  A: ["Doshik", "limpompo", "Dima", "Max"],
  B: ["anemoia", "dross", "n2ke", "Mosya"],
  C: ["maclay", "Vitas", "shpion", "Reizy"],
  D: ["Morty", "fe1nekit", "zmeuga", "fil"],
};

function playerId(name: string): string {
  return name.toLocaleLowerCase("en-US");
}

function createPlayers(): Player[] {
  return Object.entries(GROUP_PLAYERS).flatMap(([group, names], groupIndex) =>
    names.map((name, index) => ({
      id: playerId(name),
      name,
      seed: groupIndex * 4 + index + 1,
      group: group as GroupId,
    })),
  );
}

export function createDefaultState(now = new Date()): TournamentState {
  return {
    version: 1,
    title: "Турнир CS2 1x1 (16 игроков)",
    players: createPlayers(),
    winners: {},
    matchSettings: {},
    mapVeto: [],
    updatedAt: now.toISOString(),
  };
}
