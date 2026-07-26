import { HttpError } from "./http";
import { clientIp } from "./security";
import type { ServerEnv } from "./types";

const encoder = new TextEncoder();
const SCOPE_PATTERN = /^[a-z0-9:_-]{1,64}$/i;

function sessionSecret(env: ServerEnv): string {
  const secret = env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "SESSION_SECRET должен содержать не менее 32 символов",
    );
  }
  return secret;
}

async function actorHash(env: ServerEnv, request: Request): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret(env)),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`rate-limit:v1\0${clientIp(request)}`),
    ),
  );
  return Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function enforceRateLimit(
  env: ServerEnv,
  request: Request,
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<void> {
  if (
    !SCOPE_PATTERN.test(scope) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100_000 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > 86_400
  ) {
    throw new HttpError(
      500,
      "INVALID_RATE_LIMIT_CONFIGURATION",
      "Ограничение частоты запросов настроено неверно",
    );
  }

  const now = Math.floor(Date.now() / 1_000);
  const windowStart =
    Math.floor(now / windowSeconds) * windowSeconds;
  const result = await env.DB.prepare(
    `INSERT INTO rate_limits (
       scope,
       actor_hash,
       window_start,
       count
     )
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(scope, actor_hash, window_start)
     DO UPDATE SET count = rate_limits.count + 1
     WHERE rate_limits.count < ?4`,
  )
    .bind(scope, await actorHash(env, request), windowStart, limit)
    .run();

  if (result.meta.changes !== 1) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Слишком много запросов. Попробуйте немного позже.",
      {
        retryAfter: Math.max(1, windowStart + windowSeconds - now),
      },
    );
  }
}
