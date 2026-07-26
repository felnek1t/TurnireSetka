import type {
  MapVetoKind,
  TournamentMap,
  TournamentState,
} from "../types";
import { TOURNAMENT_MAPS } from "./bracket";

function isTournamentMap(value: unknown): value is TournamentMap {
  return TOURNAMENT_MAPS.some((map) => map === value);
}

function isMapVetoKind(value: unknown): value is MapVetoKind {
  return value === "ban" || value === "pick";
}

export function decideMapVeto(
  state: TournamentState,
  map: TournamentMap,
  kind: MapVetoKind,
  updatedAt = new Date().toISOString(),
): TournamentState {
  if (!isTournamentMap(map)) {
    throw new RangeError(`Неизвестная карта турнира: ${map}`);
  }
  if (!isMapVetoKind(kind)) {
    throw new RangeError(`Неизвестное действие бан/пика: ${kind}`);
  }

  const current = state.mapVeto ?? [];
  if (current.some((entry) => entry.map === map)) {
    throw new RangeError(`Карта ${map} уже отмечена в бан/пике`);
  }

  return {
    ...state,
    mapVeto: [...current, { map, kind }],
    updatedAt,
  };
}

export function removeMapVetoDecision(
  state: TournamentState,
  map: TournamentMap,
  updatedAt = new Date().toISOString(),
): TournamentState {
  const current = state.mapVeto ?? [];
  if (!current.some((entry) => entry.map === map)) {
    throw new RangeError(`Карта ${map} ещё не отмечена в бан/пике`);
  }

  return {
    ...state,
    mapVeto: current.filter((entry) => entry.map !== map),
    updatedAt,
  };
}

export function resetMapVeto(
  state: TournamentState,
  updatedAt = new Date().toISOString(),
): TournamentState {
  return {
    ...state,
    mapVeto: [],
    updatedAt,
  };
}

export function getRemainingVetoMaps(
  state: TournamentState,
): TournamentMap[] {
  const decided = new Set((state.mapVeto ?? []).map((entry) => entry.map));
  return TOURNAMENT_MAPS.filter((map) => !decided.has(map));
}
