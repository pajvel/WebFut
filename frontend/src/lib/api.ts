import type {
  ApiResponse,
  MatchDetail,
  MatchSummary,
  Me,
  ProfileResponse,
  Settings,
  TeamVariant,
  AdminUser
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  status: number;
  data?: ApiResponse<unknown>;

  constructor(message: string, status: number, data?: ApiResponse<unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path: string) {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL.replace(/\/$/, "")}\/${path.replace(/^\//, "")}`;
}

function getAuthHeaders() {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("auth_token");
  const initData = localStorage.getItem("tg_init_data");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (initData) {
    headers["X-Telegram-InitData"] = initData;
  }
  return headers;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as ApiResponse<unknown>;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  } as Record<string, string>;

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers
  });

  const data = (await parseJsonSafe(response)) as ApiResponse<T> | null;
  if (!response.ok) {
    const message = data?.error || response.statusText || "request_failed";
    throw new ApiError(message, response.status, data || undefined);
  }

  if (data && data.ok === false) {
    throw new ApiError(data.error || "request_failed", response.status, data);
  }

  if (!data) {
    return undefined as T;
  }
  const { ok, ...payload } = data as ApiResponse<T>;
  return payload as T;
}

export async function authTelegram(initData: string) {
  const result = await apiFetch<{ token?: string; tg_id: number }>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData })
  });
  return result;
}

export async function fetchMatches() {
  return apiFetch<{ matches: MatchSummary[] }>("/matches");
}

export async function createMatch(payload: {
  context_id?: number;
  venue: string;
  scheduled_at?: string | null;
}) {
  return apiFetch<{ id: number }>("/matches", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function joinMatch(matchId: number) {
  return apiFetch(`/matches/${matchId}/join`, { method: "POST" });
}

export async function spectateMatch(matchId: number) {
  return apiFetch(`/matches/${matchId}/spectate`, { method: "POST" });
}

export async function leaveMatch(matchId: number) {
  return apiFetch(`/matches/${matchId}/leave`, { method: "POST" });
}

export async function updateMemberPermissions(
  matchId: number,
  tg_id: number,
  can_edit: boolean
) {
  return apiFetch(`/matches/${matchId}/members/${tg_id}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ can_edit })
  });
}

export async function getMatch(matchId: number) {
  return apiFetch<MatchDetail>(`/matches/${matchId}`);
}

export async function generateTeams(matchId: number) {
  return apiFetch<{ variants: TeamVariant[] }>(`/matches/${matchId}/teams/generate`, {
    method: "POST"
  });
}

export async function selectTeams(
  matchId: number,
  variantNo: number,
  payload?: { team_name_a?: string; team_name_b?: string }
) {
  return apiFetch(`/matches/${matchId}/teams/select`, {
    method: "POST",
    body: JSON.stringify({ variant_no: variantNo, ...payload })
  });
}

export async function revertTeams(matchId: number) {
  return apiFetch(`/matches/${matchId}/teams/revert`, { method: "POST" });
}

export async function customTeams(matchId: number, payload: { base_variant_no: number; teams: { A: string[]; B: string[] } }) {
  return apiFetch<{ why_text: string }>(`/matches/${matchId}/teams/custom`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function startMatch(matchId: number) {
  return apiFetch(`/matches/${matchId}/start`, { method: "POST" });
}

export async function finishMatch(matchId: number, is_butt_game: boolean) {
  return apiFetch(`/matches/${matchId}/finish`, {
    method: "POST",
    body: JSON.stringify({ is_butt_game })
  });
}

export async function newSegment(matchId: number, is_butt_game: boolean) {
  return apiFetch<{ segment_id: number; seg_no: number }>(`/matches/${matchId}/segments/new`, {
    method: "POST",
    body: JSON.stringify({ is_butt_game })
  });
}

export async function deleteSegment(matchId: number, segmentId: number) {
  return apiFetch(`/matches/${matchId}/segments/${segmentId}`, { method: "DELETE" });
}

export async function goal(matchId: number, payload: {
  team: "A" | "B";
  scorer_tg_id: number;
  assist_tg_id?: number | null;
}) {
  return apiFetch(`/matches/${matchId}/events/goal`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function ownGoal(matchId: number, team: "A" | "B") {
  return apiFetch(`/matches/${matchId}/events/own-goal`, {
    method: "POST",
    body: JSON.stringify({ team })
  });
}

export async function patchEvent(
  matchId: number,
  eventId: number,
  payload: { scorer_tg_id?: number | null; assist_tg_id?: number | null }
) {
  return apiFetch(`/matches/${matchId}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteEvent(matchId: number, eventId: number) {
  return apiFetch(`/matches/${matchId}/events/${eventId}`, { method: "DELETE" });
}

export async function payerRequest(matchId: number) {
  return apiFetch(`/matches/${matchId}/payer/request`, { method: "POST" });
}

export async function payerOffer(matchId: number, tg_id: number) {
  return apiFetch(`/matches/${matchId}/payer/offer`, {
    method: "POST",
    body: JSON.stringify({ tg_id })
  });
}

export async function payerRespond(matchId: number, accepted: boolean) {
  return apiFetch(`/matches/${matchId}/payer/respond`, {
    method: "POST",
    body: JSON.stringify({ accepted })
  });
}

export async function payerSelect(matchId: number, payer_tg_id: number) {
  return apiFetch(`/matches/${matchId}/payer/select`, {
    method: "POST",
    body: JSON.stringify({ payer_tg_id })
  });
}

export async function payerClear(matchId: number) {
  return apiFetch(`/matches/${matchId}/payer/clear`, {
    method: "POST"
  });
}

export async function payerDetails(matchId: number, payload: {
  payer_fio: string;
  payer_phone: string;
  payer_bank: string;
}) {
  return apiFetch(`/matches/${matchId}/payer/details`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function markPaid(matchId: number) {
  return apiFetch(`/matches/${matchId}/payments/mark-paid`, { method: "POST" });
}

export async function confirmPayment(matchId: number, payload: {
  tg_id: number;
  approved: boolean;
}) {
  return apiFetch(`/matches/${matchId}/payments/confirm`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitFeedback(matchId: number, payload: {
  answers_json: Record<string, unknown>;
  mvp_vote_tg_id?: number | null;
}) {
  return apiFetch(`/matches/${matchId}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getFeedback(matchId: number) {
  return apiFetch<{ answers_json: Record<string, unknown> | null; mvp_vote_tg_id: number | null }>(
    `/matches/${matchId}/feedback`
  );
}

export async function getMe() {
  return apiFetch<Me>("/me");
}

export async function patchMe(payload: { custom_name?: string | null; custom_avatar?: string | null }) {
  return apiFetch("/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ url: string }>("/me/avatar", {
    method: "POST",
    body: form
  });
}

export async function getSettings() {
  return apiFetch<Settings>("/me/settings");
}

export async function patchSettings(payload: Partial<Settings>) {
  return apiFetch("/me/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getProfile() {
  return apiFetch<ProfileResponse>("/me/profile");
}

export async function getUserProfile(tgId: number) {
  return apiFetch<ProfileResponse>(`/users/${tgId}/profile`);
}

export async function adminListUsers() {
  return apiFetch<{ users: AdminUser[] }>("/admin/users");
}

export async function adminGetState(contextId = 1) {
  return apiFetch<{
    context_id: number;
    players: Array<{
      player_id: string;
      global_rating: number;
      venue_ratings: Record<string, number>;
      role_tendencies?: Record<string, number>;
      is_guest: boolean;
      guest_matches: number;
      tier_bonus: number;
    }>;
  }>(`/admin/state?context_id=${contextId}`);
}

export async function adminPatchStatePlayer(payload: {
  player_id: string;
  context_id?: number;
  global_rating?: number;
  venue_ratings?: Record<string, number>;
}) {
  return apiFetch("/admin/state/player", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function adminBindStatePlayer(payload: {
  player_id: string;
  tg_id: number;
  context_id?: number;
}) {
  return apiFetch("/admin/state/player/bind", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function adminGetRatingLogs(params: { player_id?: string; match_id?: number }) {
  const query = new URLSearchParams();
  if (params.player_id) query.set("player_id", params.player_id);
  if (params.match_id) query.set("match_id", String(params.match_id));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{ logs: Array<{
    id: number;
    match_id: number;
    player_id: string;
    venue: string;
    delta: number;
    pre_global: number;
    post_global: number;
    pre_venue: number;
    post_venue: number;
    goals: number;
    assists: number;
    details?: Record<string, number>;
    created_at: string;
  }> }>(`/admin/rating-logs${suffix}`);
}

export async function adminRebuildRatingLogs(context_id = 1) {
  return apiFetch<{ matches: number }>(`/admin/rating-logs/rebuild`, {
    method: "POST",
    body: JSON.stringify({ context_id })
  });
}

export async function adminGetInteractions(params: { context_id?: number; venue: string; kind: "synergy" | "domination" }) {
  const query = new URLSearchParams();
  query.set("venue", params.venue);
  query.set("kind", params.kind);
  query.set("context_id", String(params.context_id ?? 1));
  return apiFetch<{ players: string[]; values: number[][]; venue: string; kind: string }>(
    `/admin/interactions?${query.toString()}`
  );
}

export async function adminPatchInteraction(payload: {
  context_id?: number;
  venue: string;
  kind: "synergy" | "domination";
  player_a: string;
  player_b: string;
  value: number;
}) {
  return apiFetch("/admin/interactions", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function adminGetInteractionLogs(params: {
  context_id?: number;
  venue?: string;
  kind?: "synergy" | "domination";
  player?: string;
}) {
  const query = new URLSearchParams();
  if (params.venue) query.set("venue", params.venue);
  if (params.kind) query.set("kind", params.kind);
  if (params.player) query.set("player", params.player);
  query.set("context_id", String(params.context_id ?? 1));
  return apiFetch<{ logs: Array<{
    id: number;
    context_id: number;
    match_id: number | null;
    venue: string;
    kind: string;
    player_a: string;
    player_b: string;
    value_before: number;
    value_after: number;
    source: string;
    created_at: string;
  }> }>(`/admin/interaction-logs?${query.toString()}`);
}

export async function adminRebuildInteractionLogs(context_id = 1) {
  return apiFetch<{ matches: number }>(`/admin/interaction-logs/rebuild`, {
    method: "POST",
    body: JSON.stringify({ context_id })
  });
}

export async function adminCreateUser(payload: { tg_id?: number; name: string }) {
  return apiFetch<{ tg_id: number }>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function adminPatchUser(tg_id: number, payload: { custom_name?: string | null; custom_avatar?: string | null }) {
  return apiFetch(`/admin/users/${tg_id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function adminAddMatchMembers(matchId: number, members: Array<{ tg_id: number; role: string; can_edit: boolean }>) {
  return apiFetch(`/admin/matches/${matchId}/members`, {
    method: "POST",
    body: JSON.stringify({ members })
  });
}

export async function adminRemoveMatchMember(matchId: number, tg_id: number) {
  return apiFetch(`/admin/matches/${matchId}/members/${tg_id}`, { method: "DELETE" });
}

export async function adminPatchSegment(
  matchId: number,
  segmentId: number,
  payload: { score_a?: number; score_b?: number; ended_at?: string }
) {
  return apiFetch(`/admin/matches/${matchId}/segments/${segmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
