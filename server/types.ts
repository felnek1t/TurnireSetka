export const GROUP_IDS = ["A", "B", "C", "D"] as const;
export const TOURNAMENT_MAPS = [
  "de_dust2",
  "de_mirage",
  "de_overpass",
  "de_inferno",
  "de_nuke",
  "de_train",
] as const;

export type GroupId = (typeof GROUP_IDS)[number];
export type TournamentMap = (typeof TOURNAMENT_MAPS)[number];
export type MapVetoKind = "ban" | "pick";
export type BracketEntrantStage = "last-chance" | "playoff";
export type BracketEntrantOrder = [string, string, string, string];
export type BracketEntrants = Partial<
  Record<BracketEntrantStage, BracketEntrantOrder>
>;

export interface ServerEnv {
  DB: D1Database;
  ADMIN_PIN?: string;
  SESSION_SECRET?: string;
}

export type Env = ServerEnv;

export interface Player {
  id: string;
  name: string;
  seed: number;
  group: GroupId;
}

export interface MatchSettings {
  map?: TournamentMap;
  ctPlayerId?: string;
}

export interface MapVetoEntry {
  map: TournamentMap;
  kind: MapVetoKind;
}

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

export interface VoteBallot {
  playerId: string;
  createdAt: string;
  receipt: string;
}

export interface VoteSummary {
  total: number;
  byPlayer: Record<string, number>;
  myVote?: string;
}

export interface DashboardResponse {
  state: TournamentState;
  votes: VoteSummary;
  isAdmin: boolean;
}
