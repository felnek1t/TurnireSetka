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
import { requireAdmin } from "../lib/security";
import { getTournamentState, saveTournamentState } from "../lib/storage";
import { parseExpectedVersion, validateTournamentState } from "../lib/validation";

const METHODS = ["GET", "PUT", "OPTIONS"] as const;
const MAX_STATE_BODY_BYTES = 64 * 1024;

async function handleGet(request: Request, context: Context): Promise<Response> {
  const dashboard = await buildDashboard(request, context);
  return jsonResponse(request, dashboard);
}

async function handlePut(request: Request, context: Context): Promise<Response> {
  requireAdmin(request);

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

  const current = await getTournamentState();
  if (current.state.version !== expectedVersion) {
    throw new HttpError(
      409,
      "STATE_CONFLICT",
      "Сетка уже была изменена в другой вкладке. Обновите данные.",
      { currentVersion: current.state.version },
    );
  }

  const nextState = {
    ...proposedState,
    version: expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  };

  const modified = await saveTournamentState(nextState, current.etag);
  if (!modified) {
    const latest = await getTournamentState();
    throw new HttpError(
      409,
      "STATE_CONFLICT",
      "Сетка уже была изменена в другой вкладке. Обновите данные.",
      { currentVersion: latest.state.version },
    );
  }

  const dashboard = await buildDashboard(request, context, nextState, true);
  return jsonResponse(request, dashboard);
}

export default async function state(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);

    if (request.method === "GET") {
      return await handleGet(request, context);
    }

    if (request.method === "PUT") {
      return await handlePut(request, context);
    }

    return methodNotAllowed(request, METHODS);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config: Config = {
  path: "/api/state",
  method: ["GET", "PUT", "OPTIONS"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 120,
    windowSize: 60,
  },
};
