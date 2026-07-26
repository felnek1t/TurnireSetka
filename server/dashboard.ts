import { isAdminRequest, voteKey } from "./security";
import {
  getTournamentState,
  getVoteSummary,
  initializeStorage,
} from "./storage";
import type {
  DashboardResponse,
  ServerEnv,
  TournamentState,
} from "./types";

export async function buildDashboard(
  request: Request,
  env: ServerEnv,
  state?: TournamentState,
  forceAdmin?: boolean,
): Promise<DashboardResponse> {
  await initializeStorage(env);

  const currentState = state ?? (await getTournamentState(env)).state;
  const currentVoterKey = await voteKey(request, env, false);
  const [votes, isAdmin] = await Promise.all([
    getVoteSummary(env, currentState, currentVoterKey),
    forceAdmin === undefined
      ? isAdminRequest(request, env)
      : Promise.resolve(forceAdmin),
  ]);

  return {
    state: currentState,
    votes,
    isAdmin,
  };
}
