import { ValidationError } from "./validation";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
type ResponseHeadersInit =
  | Headers
  | Record<string, string>
  | [string, string][];

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function responseHeaders(
  request: Request,
  extraHeaders?: ResponseHeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);
  headers.set("cache-control", "no-store");
  headers.set("content-type", JSON_CONTENT_TYPE);
  headers.set("x-content-type-options", "nosniff");

  const origin = request.headers.get("origin");
  if (origin && sameOrigin(request)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.append("vary", "Origin");
  }

  return headers;
}

export function jsonResponse(
  request: Request,
  data: unknown,
  status = 200,
  extraHeaders?: ResponseHeadersInit,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders(request, extraHeaders),
  });
}

export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    throw new HttpError(
      403,
      "ORIGIN_FORBIDDEN",
      "Запросы с другого сайта запрещены",
    );
  }

  const origin = request.headers.get("origin");
  if (origin && !sameOrigin(request)) {
    throw new HttpError(
      403,
      "ORIGIN_FORBIDDEN",
      "Запросы с другого сайта запрещены",
    );
  }
}

export function preflightResponse(
  request: Request,
  methods: readonly string[],
): Response {
  assertSameOrigin(request);

  const headers = responseHeaders(request);
  headers.delete("content-type");
  headers.set("access-control-allow-methods", methods.join(", "));
  headers.set(
    "access-control-allow-headers",
    "content-type, x-device-signal",
  );
  headers.set("access-control-max-age", "600");

  return new Response(null, { status: 204, headers });
}

export function methodNotAllowed(
  request: Request,
  methods: readonly string[],
): Response {
  return jsonResponse(
    request,
    {
      error: "Метод не поддерживается",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
    { allow: methods.join(", ") },
  );
}

export async function readJson(
  request: Request,
  maxBytes: number,
  allowEmpty = false,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Ожидается Content-Type: application/json",
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком большое");
    }
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком большое");
  }

  if (text.trim() === "") {
    if (allowEmpty) {
      return {};
    }
    throw new HttpError(400, "INVALID_JSON", "Тело запроса не может быть пустым");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Некорректный JSON");
  }
}

export function requireObject(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_BODY", "Ожидается JSON-объект");
  }

  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "Тело запроса содержит неизвестные поля",
    );
  }

  return record;
}

export function errorResponse(request: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      request,
      {
        error: error.message,
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      error.status,
    );
  }

  if (error instanceof ValidationError) {
    return jsonResponse(
      request,
      {
        error: error.message,
        code: "VALIDATION_ERROR",
        details: error.issues,
      },
      400,
    );
  }

  console.error("Unhandled API error", error);
  return jsonResponse(
    request,
    {
      error: "Внутренняя ошибка сервера",
      code: "INTERNAL_ERROR",
    },
    500,
  );
}
