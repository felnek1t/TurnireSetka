import { buildDashboard } from "../../server/dashboard";
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
} from "../../server/http";
import { enforceRateLimit } from "../../server/rate-limit";
import { requireAdmin } from "../../server/security";
import {
  deleteAllBallots,
  getTournamentState,
  initializeStorage,
} from "../../server/storage";
import type { ServerEnv } from "../../server/types";

const METHODS = ["DELETE", "OPTIONS"] as const;

export const onRequest: PagesFunction<ServerEnv> = async ({
  request,
  env,
}) => {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method !== "DELETE") {
      return methodNotAllowed(request, METHODS);
    }

    await initializeStorage(env);
    await requireAdmin(request, env);
    await enforceRateLimit(env, request, "votes:reset", 5);
    await deleteAllBallots(env);

    const current = await getTournamentState(env);
    return jsonResponse(
      request,
      await buildDashboard(request, env, current.state, true),
    );
  } catch (error) {
    return errorResponse(request, error);
  }
};
