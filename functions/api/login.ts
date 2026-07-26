import { buildDashboard } from "../../server/dashboard";
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
import {
  createAdminSessionCookie,
  verifyPin,
} from "../../server/security";
import { initializeStorage } from "../../server/storage";
import type { ServerEnv } from "../../server/types";

const METHODS = ["POST", "OPTIONS"] as const;
const MAX_LOGIN_BODY_BYTES = 2 * 1024;

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
    await enforceRateLimit(env, request, "login", 8);

    const body = requireObject(
      await readJson(request, MAX_LOGIN_BODY_BYTES),
      ["pin"],
    );
    await verifyPin(body.pin, env);

    const cookie = await createAdminSessionCookie(request, env);
    const dashboard = await buildDashboard(
      request,
      env,
      undefined,
      true,
    );
    return jsonResponse(request, dashboard, 200, { "set-cookie": cookie });
  } catch (error) {
    return errorResponse(request, error);
  }
};
