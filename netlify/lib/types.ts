export const GROUP_IDS = ["A", "B", "C", "D"] as const;

export type GroupId = (typeof GROUP_IDS)[number];

export interface Player {
  id: string;
  name: string;
  seed: number;
  group: GroupId;
}

export interface TournamentState {
  version: number;
  title: string;
  players: Player[];
  winners: Record<string, string>;
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

export interface StoredTournamentState {
  state: TournamentState;
  etag: string;
}
