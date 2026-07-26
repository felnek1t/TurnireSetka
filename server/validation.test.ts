import { describe, expect, it } from "vitest";
import { createDefaultState } from "./default-state";
import { ValidationError, validateTournamentState } from "./validation";

describe("tournament state map veto validation", () => {
  it("normalizes legacy persisted state without mapVeto", () => {
    const legacy = { ...createDefaultState() } as Record<string, unknown>;
    delete legacy.mapVeto;

    expect(validateTournamentState(legacy).mapVeto).toEqual([]);
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
