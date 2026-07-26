import { HttpError } from "./http";
import type { ServerEnv } from "./types";

const SESSION_COOKIE = "tournament_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const DEVICE_SIGNAL_PATTERN = /^[a-f0-9]{64}$/i;
const IP_PATTERN = /^[0-9a-f:.]{2,64}$/i;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SessionPayload {
  role: "admin";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

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

function adminPin(env: ServerEnv): string {
  const configuredPin = env.ADMIN_PIN;
  if (
    typeof configuredPin === "string" &&
    configuredPin.length >= 1 &&
    configuredPin.length <= 128
  ) {
    return configuredPin;
  }

  throw new HttpError(
    500,
    "SERVER_MISCONFIGURED",
    "ADMIN_PIN не настроен",
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToText(value: string): string {
  if (!/^[a-z0-9_-]+$/i.test(value)) {
    throw new Error("Invalid base64url");
  }

  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decoder.decode(bytes);
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    sha256(left),
    sha256(right),
  ]);

  let difference = leftDigest.length ^ rightDigest.length;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}

async function hmacSha256(
  secret: string,
  value: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function sign(value: string, env: ServerEnv): Promise<string> {
  const signature = await hmacSha256(
    sessionSecret(env),
    `admin-session:v1:${value}`,
  );
  return bytesToBase64Url(signature);
}

function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const header = request.headers.get("cookie");
  if (!header || header.length > 8_192) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) {
      cookies.set(key, value);
    }
  }

  return cookies;
}

function secureCookie(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function cookieAttributes(request: Request): string {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    ...(secureCookie(request) ? ["Secure"] : []),
  ].join("; ");
}

export function clientIp(request: Request): string {
  const candidate = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (IP_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  ) {
    return "127.0.0.1";
  }

  throw new HttpError(
    400,
    "CLIENT_IP_UNAVAILABLE",
    "Не удалось определить адрес клиента",
  );
}

export async function verifyPin(
  pin: unknown,
  env: ServerEnv,
): Promise<void> {
  if (typeof pin !== "string" || pin.length < 1 || pin.length > 128) {
    throw new HttpError(400, "INVALID_PIN", "Введите PIN-код");
  }

  if (!(await constantTimeEqual(pin, adminPin(env)))) {
    throw new HttpError(401, "INVALID_PIN", "Неверный PIN-код");
  }
}

export async function createAdminSessionCookie(
  request: Request,
  env: ServerEnv,
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);

  const payload: SessionPayload = {
    role: "admin",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
    nonce: bytesToBase64Url(nonce),
  };
  const encodedPayload = textToBase64Url(JSON.stringify(payload));
  const value = `${encodedPayload}.${await sign(encodedPayload, env)}`;

  return [
    `${SESSION_COOKIE}=${value}`,
    cookieAttributes(request),
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearAdminSessionCookie(request: Request): string {
  return [
    `${SESSION_COOKIE}=`,
    cookieAttributes(request),
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function isAdminRequest(
  request: Request,
  env: ServerEnv,
): Promise<boolean> {
  const value = parseCookies(request).get(SESSION_COOKIE);
  if (!value || value.length > 2_048) {
    return false;
  }

  const separator = value.indexOf(".");
  if (separator < 1 || separator !== value.lastIndexOf(".")) {
    return false;
  }

  const encodedPayload = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  const expectedSignature = await sign(encodedPayload, env);

  if (!(await constantTimeEqual(providedSignature, expectedSignature))) {
    return false;
  }

  try {
    const payload = JSON.parse(
      base64UrlToText(encodedPayload),
    ) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1_000);

    return (
      payload.role === "admin" &&
      Number.isInteger(payload.issuedAt) &&
      Number.isInteger(payload.expiresAt) &&
      typeof payload.nonce === "string" &&
      /^[a-z0-9_-]{22}$/i.test(payload.nonce) &&
      (payload.issuedAt as number) <= now + 60 &&
      (payload.expiresAt as number) > now &&
      (payload.expiresAt as number) - (payload.issuedAt as number) ===
        SESSION_TTL_SECONDS
    );
  } catch {
    return false;
  }
}

export async function requireAdmin(
  request: Request,
  env: ServerEnv,
): Promise<void> {
  if (!(await isAdminRequest(request, env))) {
    throw new HttpError(
      401,
      "ADMIN_REQUIRED",
      "Для этого действия нужно войти как администратор",
    );
  }
}

export async function voteKey(
  request: Request,
  env: ServerEnv,
  required: boolean,
): Promise<string | undefined> {
  const rawDeviceSignal = request.headers.get("x-device-signal")?.trim() ?? "";
  if (!DEVICE_SIGNAL_PATTERN.test(rawDeviceSignal)) {
    if (required) {
      throw new HttpError(
        400,
        "DEVICE_SIGNAL_REQUIRED",
        "Не удалось определить устройство для голосования",
      );
    }
    return undefined;
  }

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 512);
  const digest = await hmacSha256(
    sessionSecret(env),
    [
      "guest-vote:v1",
      clientIp(request),
      rawDeviceSignal.toLowerCase(),
      userAgent,
    ].join("\0"),
  );

  return `ballots/${Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}
