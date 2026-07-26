import type { TournamentState } from "../types";
import { getDeviceSignal } from "./fingerprint";

export interface VoteSummary {
  total: number;
  byPlayer: Record<string, number>;
  myVote?: string;
}

export interface DashboardResponse {
  state: TournamentState;
  votes: VoteSummary;
  isAdmin: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    payload?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
  }
}

let deviceSignalPromise: Promise<string> | undefined;

function deviceSignal(): Promise<string> {
  deviceSignalPromise ??= getDeviceSignal();
  return deviceSignalPromise;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const signal = await deviceSignal();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("x-device-signal", signal);

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string; details?: unknown })
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error || "Не удалось связаться с сервером",
      response.status,
      payload
        ? { code: payload.code, details: payload.details }
        : undefined,
    );
  }

  if (!payload) {
    throw new ApiError("Сервер вернул пустой ответ", response.status);
  }

  return payload;
}

export function getDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/state");
}

export function login(pin: string): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function saveTournament(
  state: TournamentState,
): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/state", {
    method: "PUT",
    body: JSON.stringify({
      state,
      expectedVersion: state.version,
    }),
  });
}

export function castVote(playerId: string): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/vote", {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export function resetVotes(): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/votes", {
    method: "DELETE",
  });
}
