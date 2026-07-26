import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { HttpError } from "./http";

const SESSION_COOKIE = "tournament_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const DEVICE_SIGNAL_PATTERN = /^[a-f0-9]{64}$/i;

interface SessionPayload {
  role: "admin";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "SESSION_SECRET должен содержать не менее 32 символов",
    );
  }
  return secret;
}

function adminPin(): string {
  const configuredPin = process.env.ADMIN_PIN;
  if (configuredPin && configuredPin.length <= 128) {
    return configuredPin;
  }

  if (process.env.NODE_ENV === "development") {
    return "6996";
  }

  throw new HttpError(
    500,
    "SERVER_MISCONFIGURED",
    "ADMIN_PIN не настроен",
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret())
    .update(`admin-session:v1:${value}`)
    .digest("base64url");
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

export function verifyPin(pin: unknown): void {
  if (typeof pin !== "string" || pin.length < 1 || pin.length > 128) {
    throw new HttpError(400, "INVALID_PIN", "Введите PIN-код");
  }

  if (!constantTimeEqual(pin, adminPin())) {
    throw new HttpError(401, "INVALID_PIN", "Неверный PIN-код");
  }
}

export function createAdminSessionCookie(request: Request): string {
  const now = Math.floor(Date.now() / 1_000);
  const payload: SessionPayload = {
    role: "admin",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const value = `${encodedPayload}.${sign(encodedPayload)}`;

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

export function isAdminRequest(request: Request): boolean {
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
  const expectedSignature = sign(encodedPayload);

  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1_000);

    return (
      payload.role === "admin" &&
      Number.isInteger(payload.issuedAt) &&
      Number.isInteger(payload.expiresAt) &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 16 &&
      (payload.issuedAt as number) <= now + 60 &&
      (payload.expiresAt as number) > now
    );
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request): void {
  if (!isAdminRequest(request)) {
    throw new HttpError(
      401,
      "ADMIN_REQUIRED",
      "Для этого действия нужно войти как администратор",
    );
  }
}

export function voteKey(
  request: Request,
  ip: string,
  required: boolean,
): string | undefined {
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
  const normalizedIp = ip.trim().slice(0, 128);
  const digest = createHmac("sha256", sessionSecret())
    .update("guest-vote:v1\0")
    .update(normalizedIp)
    .update("\0")
    .update(rawDeviceSignal.toLocaleLowerCase("en-US"))
    .update("\0")
    .update(userAgent)
    .digest("hex");

  return `ballots/${digest}`;
}
