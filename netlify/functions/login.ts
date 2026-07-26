import type { Config, Context } from "@netlify/functions";

import { buildDashboard } from "../lib/dashboard";
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJson,
  requireObject,
} from "../lib/http";
import { createAdminSessionCookie, verifyPin } from "../lib/security";

const METHODS = ["POST", "OPTIONS"] as const;
const MAX_LOGIN_BODY_BYTES = 2 * 1024;

export default async function login(
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
      await readJson(request, MAX_LOGIN_BODY_BYTES),
      ["pin"],
    );
    verifyPin(body.pin);

    const cookie = createAdminSessionCookie(request);
    const dashboard = await buildDashboard(request, context, undefined, true);
    return jsonResponse(request, dashboard, 200, { "set-cookie": cookie });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config: Config = {
  path: "/api/login",
  method: ["POST", "OPTIONS"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 8,
    windowSize: 60,
  },
};
