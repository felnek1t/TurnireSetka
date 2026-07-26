import type { Config, Context } from "@netlify/functions";

import { buildDashboard } from "../lib/dashboard";
import {
  assertSameOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJson,
  requireObject,
} from "../lib/http";
import { voteKey } from "../lib/security";
import { createBallot, getBallot, getTournamentState } from "../lib/storage";

const METHODS = ["POST", "OPTIONS"] as const;
const MAX_VOTE_BODY_BYTES = 2 * 1024;

export default async function vote(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method !== "POST") {
      return methodNotAllowed(request, METHODS);
    }

    const body = requireObject(
      await readJson(request, MAX_VOTE_BODY_BYTES),
      ["playerId"],
    );
    if (
      typeof body.playerId !== "string" ||
      body.playerId.length < 1 ||
      body.playerId.length > 40
    ) {
      throw new HttpError(
        400,
        "INVALID_PLAYER",
        "Укажите корректного игрока",
      );
    }

    const current = await getTournamentState();
    const player = current.state.players.find(
      (candidate) => candidate.id === body.playerId,
    );
    if (!player) {
      throw new HttpError(404, "PLAYER_NOT_FOUND", "Игрок не найден");
    }

    const ballotKey = voteKey(request, context.ip, true) as string;
    const modified = await createBallot(ballotKey, player.id);
    if (!modified) {
      const existingBallot = await getBallot(ballotKey);
      throw new HttpError(
        409,
        "ALREADY_VOTED",
        "С этого устройства уже голосовали",
        existingBallot ? { myVote: existingBallot.playerId } : undefined,
      );
    }

    const dashboard = await buildDashboard(request, context, current.state);
    return jsonResponse(request, dashboard);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config: Config = {
  path: "/api/vote",
  method: ["POST", "OPTIONS"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 12,
    windowSize: 60,
  },
};
