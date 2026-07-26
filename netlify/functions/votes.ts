import type { Config, Context } from "@netlify/functions";

import { buildDashboard } from "../lib/dashboard";
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
} from "../lib/http";
import { requireAdmin } from "../lib/security";
import { deleteAllBallots, getTournamentState } from "../lib/storage";

const METHODS = ["DELETE", "OPTIONS"] as const;

export default async function votes(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method !== "DELETE") {
      return methodNotAllowed(request, METHODS);
    }

    requireAdmin(request);
    await deleteAllBallots();

    const current = await getTournamentState();
    const dashboard = await buildDashboard(
      request,
      context,
      current.state,
      true,
    );
    return jsonResponse(request, dashboard);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config: Config = {
  path: "/api/votes",
  method: ["DELETE", "OPTIONS"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 5,
    windowSize: 60,
  },
};
