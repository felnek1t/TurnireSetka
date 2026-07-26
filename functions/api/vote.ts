import { buildDashboard } from "../../server/dashboard";
import {
  assertSameOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJson,
  requireObject,
} from "../../server/http";
import { enforceRateLimit } from "../../server/rate-limit";
import { voteKey } from "../../server/security";
import {
  createBallot,
  getBallot,
  getTournamentState,
  initializeStorage,
} from "../../server/storage";
import type { ServerEnv } from "../../server/types";

const METHODS = ["POST", "OPTIONS"] as const;
const MAX_VOTE_BODY_BYTES = 2 * 1024;

export const onRequest: PagesFunction<ServerEnv> = async ({
  request,
  env,
}) => {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method !== "POST") {
      return methodNotAllowed(request, METHODS);
    }

    await initializeStorage(env);
    await enforceRateLimit(env, request, "vote:create", 12);

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

    const current = await getTournamentState(env);
    const player = current.state.players.find(
      (candidate) => candidate.id === body.playerId,
    );
    if (!player) {
      throw new HttpError(404, "PLAYER_NOT_FOUND", "Игрок не найден");
    }

    const voterKey = (await voteKey(request, env, true)) as string;
    const modified = await createBallot(env, voterKey, player.id);
    if (!modified) {
      const existingBallot = await getBallot(env, voterKey);
      throw new HttpError(
        409,
        "ALREADY_VOTED",
        "С этого устройства уже голосовали",
        existingBallot ? { myVote: existingBallot.playerId } : undefined,
      );
    }

    return jsonResponse(
      request,
      await buildDashboard(request, env, current.state),
    );
  } catch (error) {
    return errorResponse(request, error);
  }
};
