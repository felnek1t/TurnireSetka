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
import { requireAdmin } from "../../server/security";
import {
  getTournamentState,
  initializeStorage,
  saveTournamentState,
} from "../../server/storage";
import type { ServerEnv } from "../../server/types";
import {
  parseExpectedVersion,
  validateTournamentState,
} from "../../server/validation";

const METHODS = ["GET", "PUT", "OPTIONS"] as const;
const MAX_STATE_BODY_BYTES = 64 * 1024;

async function handleGet(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  return jsonResponse(request, await buildDashboard(request, env));
}

async function handlePut(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  await initializeStorage(env);
  await requireAdmin(request, env);
  await enforceRateLimit(env, request, "state:update", 120);

  const body = requireObject(
    await readJson(request, MAX_STATE_BODY_BYTES),
    ["state", "expectedVersion"],
  );
  const expectedVersion = parseExpectedVersion(body.expectedVersion);
  const proposedState = validateTournamentState(body.state);

  if (proposedState.version !== expectedVersion) {
    throw new HttpError(
      400,
      "VERSION_MISMATCH",
      "state.version должен совпадать с expectedVersion",
    );
  }

  const nextState = {
    ...proposedState,
    version: expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  const modified = await saveTournamentState(
    env,
    nextState,
    expectedVersion,
  );

  if (!modified) {
    const latest = await getTournamentState(env);
    throw new HttpError(
      409,
      "STATE_CONFLICT",
      "Сетка уже была изменена в другой вкладке. Обновите данные.",
      { currentVersion: latest.state.version },
    );
  }

  return jsonResponse(
    request,
    await buildDashboard(request, env, nextState, true),
  );
}

export const onRequest: PagesFunction<ServerEnv> = async ({
  request,
  env,
}) => {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method === "GET") {
      return await handleGet(request, env);
    }
    if (request.method === "PUT") {
      return await handlePut(request, env);
    }

    return methodNotAllowed(request, METHODS);
  } catch (error) {
    return errorResponse(request, error);
  }
};
