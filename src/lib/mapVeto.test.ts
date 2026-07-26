import { describe, expect, it } from "vitest";
import { createDefaultTournament } from "../data/defaultTournament";
import {
  decideMapVeto,
  getRemainingVetoMaps,
  removeMapVetoDecision,
  resetMapVeto,
} from "./mapVeto";

const NOW = "2026-07-27T10:00:00.000Z";
const LATER = "2026-07-27T10:05:00.000Z";

describe("map veto", () => {
  it("starts empty with all six maps remaining", () => {
    const state = createDefaultTournament(NOW);

    expect(state.mapVeto).toEqual([]);
    expect(getRemainingVetoMaps(state)).toEqual([
      "de_dust2",
      "de_mirage",
      "de_overpass",
      "de_inferno",
      "de_nuke",
      "de_train",
    ]);
  });

  it("records bans and picks in order without changing the bracket", () => {
    const initial = createDefaultTournament(NOW);
    const banned = decideMapVeto(initial, "de_nuke", "ban", LATER);
    const picked = decideMapVeto(
      banned,
      "de_mirage",
      "pick",
      LATER,
    );

    expect(picked.mapVeto).toEqual([
      { map: "de_nuke", kind: "ban" },
      { map: "de_mirage", kind: "pick" },
    ]);
    expect(picked.winners).toEqual(initial.winners);
    expect(picked.matchSettings).toEqual(initial.matchSettings);
    expect(getRemainingVetoMaps(picked)).not.toContain("de_nuke");
  });

  it("rejects a second decision for the same map", () => {
    const state = decideMapVeto(
      createDefaultTournament(NOW),
      "de_train",
      "ban",
      LATER,
    );

    expect(() =>
      decideMapVeto(state, "de_train", "pick", LATER),
    ).toThrow(/уже отмечена/i);
  });

  it("can undo one decision and reset only the veto board", () => {
    const initial = {
      ...createDefaultTournament(NOW),
      winners: { "group-a-opening-1": "doshik" },
      matchSettings: {
        "group-a-opening-1": {
          map: "de_dust2" as const,
          ctPlayerId: "doshik",
        },
      },
    };
    const decided = decideMapVeto(initial, "de_nuke", "ban", LATER);
    const undone = removeMapVetoDecision(decided, "de_nuke", LATER);
    const reset = resetMapVeto(
      decideMapVeto(undone, "de_mirage", "pick", LATER),
      LATER,
    );

    expect(undone.mapVeto).toEqual([]);
    expect(reset.mapVeto).toEqual([]);
    expect(reset.winners).toEqual(initial.winners);
    expect(reset.matchSettings).toEqual(initial.matchSettings);
  });
});
