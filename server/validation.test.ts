import { describe, expect, it } from "vitest";
import {
  GROUP_IDS,
  GROUP_MATCH_IDS,
  setMatchWinner,
} from "../src/lib/bracket";
import type { GroupId } from "../src/types";
import { createDefaultState } from "./default-state";
import { ValidationError, validateTournamentState } from "./validation";

const groupPlayers: Record<GroupId, [string, string, string]> = {
  A: ["doshik", "limpompo", "dima"],
  B: ["anemoia", "dross", "n2ke"],
  C: ["maclay", "vitas", "shpion"],
  D: ["morty", "fe1nekit", "zmeuga"],
};

function stateWithCompletedGroups() {
  let state = createDefaultState();

  for (const group of GROUP_IDS) {
    const ids = GROUP_MATCH_IDS[group];
    const [first, second, third] = groupPlayers[group];
    state = setMatchWinner(state, ids.opening1, first);
    state = setMatchWinner(state, ids.opening2, third);
    state = setMatchWinner(state, ids.winners, first);
    state = setMatchWinner(state, ids.losers, second);
    state = setMatchWinner(state, ids.decider, third);
  }

  return state;
}

describe("tournament state map veto validation", () => {
  it("normalizes legacy persisted state without new optional fields", () => {
    const legacy = { ...createDefaultState() } as Record<string, unknown>;
    delete legacy.mapVeto;
    delete legacy.bracketEntrants;

    expect(validateTournamentState(legacy).mapVeto).toEqual([]);
    expect(validateTournamentState(legacy).bracketEntrants).toEqual({});
  });

  it("keeps a valid ordered veto timeline", () => {
    const state = {
      ...createDefaultState(),
      mapVeto: [
        { map: "de_overpass", kind: "ban" },
        { map: "de_inferno", kind: "pick" },
      ],
    };

    expect(validateTournamentState(state).mapVeto).toEqual(state.mapVeto);
  });

  it.each([
    {
      label: "duplicate map",
      mapVeto: [
        { map: "de_nuke", kind: "ban" },
        { map: "de_nuke", kind: "pick" },
      ],
    },
    {
      label: "unknown map",
      mapVeto: [{ map: "de_cache", kind: "ban" }],
    },
    {
      label: "unknown kind",
      mapVeto: [{ map: "de_train", kind: "skip" }],
    },
    {
      label: "not an array",
      mapVeto: {},
    },
  ])("rejects $label", ({ mapVeto }) => {
    expect(() =>
      validateTournamentState({ ...createDefaultState(), mapVeto }),
    ).toThrow(ValidationError);
  });
});

describe("tournament bracket entrant validation", () => {
  it("accepts a unique permutation of the current qualifiers", () => {
    const state = {
      ...stateWithCompletedGroups(),
      bracketEntrants: {
        "last-chance": ["shpion", "n2ke", "dima", "zmeuga"],
        playoff: ["morty", "anemoia", "maclay", "doshik"],
      },
    };

    expect(validateTournamentState(state).bracketEntrants).toEqual(
      state.bracketEntrants,
    );
  });

  it.each([
    {
      label: "duplicate player",
      entrants: {
        "last-chance": ["dima", "n2ke", "shpion", "shpion"],
      },
    },
    {
      label: "wrong length",
      entrants: { playoff: ["doshik", "anemoia"] },
    },
    {
      label: "unknown stage",
      entrants: { group: ["doshik", "anemoia", "maclay", "morty"] },
    },
    {
      label: "non-qualifier",
      entrants: {
        "last-chance": ["doshik", "n2ke", "shpion", "zmeuga"],
      },
    },
  ])("rejects $label", ({ entrants }) => {
    expect(() =>
      validateTournamentState({
        ...stateWithCompletedGroups(),
        bracketEntrants: entrants,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects an order before all qualifiers are known", () => {
    expect(() =>
      validateTournamentState({
        ...createDefaultState(),
        bracketEntrants: {
          playoff: ["doshik", "anemoia", "maclay", "morty"],
        },
      }),
    ).toThrow(ValidationError);
  });
});
