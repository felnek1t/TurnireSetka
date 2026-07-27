export type GroupId = "A" | "B" | "C" | "D";

export interface Player {
  id: string;
  name: string;
  seed: number;
  group: GroupId;
}

export type TournamentMap =
  | "de_dust2"
  | "de_mirage"
  | "de_overpass"
  | "de_inferno"
  | "de_nuke"
  | "de_train";

export type MapVetoKind = "ban" | "pick";

export interface MapVetoEntry {
  map: TournamentMap;
  kind: MapVetoKind;
}

export type BracketEntrantStage = "last-chance" | "playoff";
export type BracketEntrantOrder = [string, string, string, string];
export type BracketEntrants = Partial<
  Record<BracketEntrantStage, BracketEntrantOrder>
>;

export interface MatchSettings {
  map?: TournamentMap;
  ctPlayerId?: string;
}

/**
 * Persisted tournament data.
 *
 * Explicit winner choices, organizer-defined match settings and optional
 * four-player entry orders are stored. Later-round participants, standings and
 * placements are derived, so stale bracket data cannot be persisted
 * accidentally.
 */
export interface TournamentState {
  version: number;
  title: string;
  players: Player[];
  winners: Record<string, string>;
  matchSettings: Record<string, MatchSettings>;
  mapVeto: MapVetoEntry[];
  bracketEntrants: BracketEntrants;
  updatedAt: string;
}

export type TournamentStage = "group" | "last-chance" | "playoff";

export type ParticipantSource =
  | {
      type: "seed";
      playerId: string;
    }
  | {
      type: "winner";
      matchId: string;
    }
  | {
      type: "loser";
      matchId: string;
    };

export interface MatchDefinition {
  id: string;
  stage: TournamentStage;
  round: number;
  order: number;
  label: string;
  bestOf: 1 | 3;
  group?: GroupId;
  sources: readonly [ParticipantSource, ParticipantSource];
}

export type MatchStatus = "locked" | "ready" | "complete";
export type TournamentStatus = "not-started" | "in-progress" | "complete";

export interface ResolvedMatch extends MatchDefinition {
  participants: readonly [Player | null, Player | null];
  winnerId: string | null;
  loserId: string | null;
  winner: Player | null;
  loser: Player | null;
  status: MatchStatus;
}

export interface GroupStanding {
  group: GroupId;
  position: 1 | 2 | 3 | 4;
  player: Player | null;
  source: ParticipantSource;
}

export interface TournamentPlacement {
  position: 1 | 2 | 3;
  player: Player | null;
  source: ParticipantSource;
}

export interface TournamentPlacementBand {
  from: number;
  to: number;
  entries: Array<{
    player: Player | null;
    source: ParticipantSource;
  }>;
}

export interface BracketEntrantSlot {
  stage: BracketEntrantStage;
  matchId: string;
  slot: 0 | 1;
}

export interface TournamentProgress {
  completed: number;
  total: number;
  ready: number;
  locked: number;
  percent: number;
  status: TournamentStatus;
}

export interface MatchDestination {
  fromMatchId: string;
  outcome: "winner" | "loser";
  toMatchId: string;
  toSlot: 0 | 1;
}

/**
 * A drag target describes the upstream result that must be written for the
 * dragged player to occupy a particular downstream slot.
 */
export interface PlayerDropTarget extends MatchDestination {
  playerId: string;
  winnerId: string;
}

export interface TournamentSnapshot {
  state: TournamentState;
  matches: ResolvedMatch[];
  groups: Record<GroupId, GroupStanding[]>;
  placements: TournamentPlacement[];
  placementBands: TournamentPlacementBand[];
  progress: TournamentProgress;
}
