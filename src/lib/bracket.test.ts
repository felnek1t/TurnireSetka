import { describe, expect, it } from "vitest";
import {
  BRACKET_MATCH_IDS,
  GROUP_IDS,
  GROUP_MATCH_IDS,
  MATCH_DEFINITIONS,
  applyPlayerDrop,
  getGroupStandings,
  getMatchDestinations,
  getPlacements,
  getResolvedMatch,
  getStageProgress,
  getTournamentProgress,
  resolvePlayerDropTarget,
  sanitizeWinners,
  setMatchWinner,
} from "./bracket";
import { createDefaultTournament, DEFAULT_PLAYERS } from "../data/defaultTournament";
import type { GroupId, TournamentState } from "../types";

const NOW = "2026-07-26T12:00:00.000Z";

const groupPlayers: Record<GroupId, [string, string, string, string]> = {
  A: ["doshik", "limpompo", "dima", "max"],
  B: ["anemoia", "dross", "n2ke", "mosya"],
  C: ["maclay", "vitas", "shpion", "reizy"],
  D: ["morty", "fe1nekit", "zmeuga", "fil"],
};

function choose(
  state: TournamentState,
  matchId: string,
  playerId: string,
): TournamentState {
  return setMatchWinner(state, matchId, playerId, NOW);
}

function completeGroup(
  state: TournamentState,
  group: GroupId,
): TournamentState {
  const ids = GROUP_MATCH_IDS[group];
  const [first, second, third] = groupPlayers[group];

  state = choose(state, ids.opening1, first);
  state = choose(state, ids.opening2, third);
  state = choose(state, ids.winners, first);
  state = choose(state, ids.losers, second);
  return choose(state, ids.decider, third);
}

describe("default tournament definition", () => {
  it("contains the 16 referenced players in four groups", () => {
    expect(DEFAULT_PLAYERS).toHaveLength(16);
    expect(DEFAULT_PLAYERS.map(({ name }) => name)).toEqual([
      "Doshik",
      "limpompo",
      "Dima",
      "Max",
      "anemoia",
      "dross",
      "n2ke",
      "Mosya",
      "maclay",
      "Vitas",
      "shpion",
      "Reizy",
      "Morty",
      "fe1nekit",
      "zmeuga",
      "fil",
    ]);

    for (const group of GROUP_IDS) {
      expect(
        DEFAULT_PLAYERS.filter((player) => player.group === group),
      ).toHaveLength(4);
    }
  });

  it("defines 20 GSL, 3 last-chance and 5 playoff matches", () => {
    expect(MATCH_DEFINITIONS).toHaveLength(28);
    expect(
      MATCH_DEFINITIONS.filter(({ stage }) => stage === "group"),
    ).toHaveLength(20);
    expect(
      MATCH_DEFINITIONS.filter(({ stage }) => stage === "last-chance"),
    ).toHaveLength(3);
    expect(
      MATCH_DEFINITIONS.filter(({ stage }) => stage === "playoff"),
    ).toHaveLength(5);
    expect(new Set(MATCH_DEFINITIONS.map(({ id }) => id)).size).toBe(28);
  });
});

describe("match resolution", () => {
  it("starts with eight ready opening matches and locks every dependency", () => {
    const state = createDefaultTournament(NOW);
    const progress = getTournamentProgress(state);

    expect(progress).toEqual({
      completed: 0,
      total: 28,
      ready: 8,
      locked: 20,
      percent: 0,
      status: "not-started",
    });
    expect(getStageProgress(state, "group").ready).toBe(8);
  });

  it("resolves all four GSL positions from winners and losers", () => {
    let state = createDefaultTournament(NOW);
    state = completeGroup(state, "A");

    expect(
      getGroupStandings(state, "A").map(({ player }) => player?.id),
    ).toEqual(["doshik", "dima", "limpompo", "max"]);
    expect(getResolvedMatch(state, GROUP_MATCH_IDS.A.decider)?.status).toBe(
      "complete",
    );
  });

  it("rejects an unknown player and a locked match", () => {
    const state = createDefaultTournament(NOW);

    expect(() =>
      choose(state, GROUP_MATCH_IDS.A.opening1, "not-a-player"),
    ).toThrow(/not a participant/i);
    expect(() =>
      choose(state, GROUP_MATCH_IDS.A.winners, "doshik"),
    ).toThrow(/not ready/i);
  });
});

describe("dependent result sanitization", () => {
  it("removes stale descendants after an early result changes", () => {
    let state = createDefaultTournament(NOW);
    state = completeGroup(state, "A");
    state = completeGroup(state, "B");
    state = choose(state, BRACKET_MATCH_IDS.lastChanceSemi1, "dima");

    expect(state.winners[BRACKET_MATCH_IDS.lastChanceSemi1]).toBe("dima");

    state = choose(state, GROUP_MATCH_IDS.A.opening1, "limpompo");

    expect(state.winners[GROUP_MATCH_IDS.A.opening1]).toBe("limpompo");
    expect(state.winners[GROUP_MATCH_IDS.A.opening2]).toBe("dima");
    expect(state.winners[GROUP_MATCH_IDS.A.winners]).toBeUndefined();
    expect(state.winners[GROUP_MATCH_IDS.A.losers]).toBeUndefined();
    expect(state.winners[GROUP_MATCH_IDS.A.decider]).toBeUndefined();
    expect(
      state.winners[BRACKET_MATCH_IDS.lastChanceSemi1],
    ).toBeUndefined();

    // The other group does not depend on the edited result.
    expect(state.winners[GROUP_MATCH_IDS.B.decider]).toBe("n2ke");
  });

  it("drops unknown and impossible persisted winner entries", () => {
    const state = createDefaultTournament(NOW);
    state.winners = {
      unknown: "doshik",
      [GROUP_MATCH_IDS.A.opening1]: "maclay",
      [GROUP_MATCH_IDS.A.winners]: "doshik",
    };

    expect(sanitizeWinners(state)).toEqual({});
  });
});

describe("drag and drop targets", () => {
  it("turns a drop into the required upstream winner choice", () => {
    const state = createDefaultTournament(NOW);
    const target = resolvePlayerDropTarget(
      state,
      "doshik",
      GROUP_MATCH_IDS.A.winners,
      0,
    );

    expect(target).toMatchObject({
      fromMatchId: GROUP_MATCH_IDS.A.opening1,
      outcome: "winner",
      toMatchId: GROUP_MATCH_IDS.A.winners,
      toSlot: 0,
      playerId: "doshik",
      winnerId: "doshik",
    });

    const nextState = applyPlayerDrop(
      state,
      "doshik",
      GROUP_MATCH_IDS.A.winners,
      0,
      NOW,
    );
    expect(nextState.winners[GROUP_MATCH_IDS.A.opening1]).toBe("doshik");
  });

  it("infers the opposite winner when dropping a player into a loser slot", () => {
    const state = createDefaultTournament(NOW);
    const target = resolvePlayerDropTarget(
      state,
      "limpompo",
      GROUP_MATCH_IDS.A.losers,
      0,
    );

    expect(target).toMatchObject({
      fromMatchId: GROUP_MATCH_IDS.A.opening1,
      outcome: "loser",
      winnerId: "doshik",
    });
    expect(getMatchDestinations(GROUP_MATCH_IDS.A.opening1)).toHaveLength(2);

    const nextState = applyPlayerDrop(
      state,
      "limpompo",
      GROUP_MATCH_IDS.A.losers,
      0,
      NOW,
    );
    expect(nextState.winners[GROUP_MATCH_IDS.A.opening1]).toBe("doshik");
  });
});

describe("complete tournament", () => {
  it("resolves last chance, upper/lower playoff and places 1–3", () => {
    let state = createDefaultTournament(NOW);

    // Choosing the first resolved competitor in topological order is a compact
    // way to exercise every winner/loser source in the whole graph.
    for (const definition of MATCH_DEFINITIONS) {
      const match = getResolvedMatch(state, definition.id);
      expect(match?.status).toBe("ready");
      state = choose(state, definition.id, match!.participants[0]!.id);
    }

    expect(getTournamentProgress(state)).toEqual({
      completed: 28,
      total: 28,
      ready: 0,
      locked: 0,
      percent: 100,
      status: "complete",
    });
    expect(getPlacements(state).map(({ player }) => player?.id)).toEqual([
      "doshik",
      "dima",
      "maclay",
    ]);
  });
});
