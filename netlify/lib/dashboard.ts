import type { Context } from "@netlify/functions";

import { isAdminRequest, voteKey } from "./security";
import { getTournamentState, getVoteSummary } from "./storage";
import type { DashboardResponse, TournamentState } from "./types";

export async function buildDashboard(
  request: Request,
  context: Context,
  state?: TournamentState,
  forceAdmin?: boolean,
): Promise<DashboardResponse> {
  const currentState = state ?? (await getTournamentState()).state;
  const currentBallotKey = voteKey(request, context.ip, false);
  const votes = await getVoteSummary(currentState, currentBallotKey);

  return {
    state: currentState,
    votes,
    isAdmin: forceAdmin ?? isAdminRequest(request),
  };
}
