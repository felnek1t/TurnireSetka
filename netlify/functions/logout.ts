import type { Config } from "@netlify/functions";

import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJson,
  requireObject,
} from "../lib/http";
import { clearAdminSessionCookie } from "../lib/security";

const METHODS = ["POST", "OPTIONS"] as const;

export default async function logout(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return preflightResponse(request, METHODS);
    }

    assertSameOrigin(request);
    if (request.method !== "POST") {
      return methodNotAllowed(request, METHODS);
    }

    const body = await readJson(request, 512, true);
    requireObject(body, []);

    return jsonResponse(
      request,
      { ok: true },
      200,
      { "set-cookie": clearAdminSessionCookie(request) },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

export const config: Config = {
  path: "/api/logout",
  method: ["POST", "OPTIONS"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowLimit: 30,
    windowSize: 60,
  },
};
