import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJson,
  requireObject,
} from "../../server/http";
import { enforceRateLimit } from "../../server/rate-limit";
import { clearAdminSessionCookie } from "../../server/security";
import { initializeStorage } from "../../server/storage";
import type { ServerEnv } from "../../server/types";

const METHODS = ["POST", "OPTIONS"] as const;

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
    await enforceRateLimit(env, request, "logout", 30);

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
};
