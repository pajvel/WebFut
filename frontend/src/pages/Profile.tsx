
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Edit2,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { fetchLobbies, getLeaderboard, getProfile, patchMe, patchSettings, uploadAvatar } from "../lib/api";
import type { LeaderboardEntry, MatchParticipant, ProfileHistoryItem, ProfileRating, ProfileStats } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { Input } from "../components/ui/input";
import { formatApiError } from "../lib/errors";
import { resolveMediaUrl } from "../lib/media";
import { formatVenueLabel } from "../lib/venue";
import {
  PROFILE_THEMES,
  applyProfileTheme,
  getStoredAvatarGrayscale,
  getStoredProfileThemeId,
  isDarkProfileTheme,
  normalizeProfileThemeId,
  persistAvatarGrayscale,
} from "../lib/profile-theme";
import { formatDateShortMsk } from "../lib/datetime";

const emptyStats: ProfileStats = {
  matches: 0,
  wins: 0,
  losses: 0,
  goals: 0,
  assists: 0,
  mvp: 0
};

const PROFILE_CACHE_KEY = "profile_cache_v1";

export type ProfileMatch = {
  id: number;
  opponent: string;
  myTeam: { name: string; avatar: string | null }[];
  opponentTeam: { name: string; avatar: string | null }[];
  scoreMyTeam: number;
  scoreOpponent: number;
  result: "WIN" | "LOSS" | "DRAW";
  dateLabel: string;
  status: ProfileHistoryItem["status"];
  mvpPlayer?: { name: string; avatar: string | null } | null;
  mvpPending?: boolean;
};

function formatShortDate(value: string | null) {
  return formatDateShortMsk(value);
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toMember(member: MatchParticipant) {
  return {
    name: member.name,
    avatar: member.avatar ? resolveMediaUrl(member.avatar) : null
  };
}

export function buildProfileMatch(match: ProfileHistoryItem, meId: number | null): ProfileMatch {
  const teamA = match.team_a_members || [];
  const teamB = match.team_b_members || [];
  const meInB = Boolean(meId && teamB.some((member) => member.tg_id === meId));
  const myTeam = meInB ? teamB : teamA;
  const opponentTeam = meInB ? teamA : teamB;
  const scoreMyTeam = meInB ? match.score_b : match.score_a;
  const scoreOpponent = meInB ? match.score_a : match.score_b;
  const result =
    scoreMyTeam === scoreOpponent ? "DRAW" : scoreMyTeam > scoreOpponent ? "WIN" : "LOSS";
  const opponentLabel = match.venue?.trim() ? formatVenueLabel(match.venue) : meInB ? "Team A" : "Team B";

  const allMembers = [...myTeam, ...opponentTeam];
  const mvpId = match.mvp?.top_tg_id ?? null;
  const mvpSource = mvpId ? allMembers.find((member) => member.tg_id === mvpId) || null : null;
  const voteCount = Object.keys(match.mvp?.votes || {}).length;
  const mvpPending = !mvpSource && (match.status !== "finished" || voteCount === 0);
  return {
    id: match.id,
    opponent: opponentLabel,
    myTeam: myTeam.map(toMember),
    opponentTeam: opponentTeam.map(toMember),
    scoreMyTeam,
    scoreOpponent,
    result,
    dateLabel: formatShortDate(match.finished_at || match.scheduled_at || match.created_at),
    status: match.status,
    mvpPlayer: mvpSource
      ? { name: mvpSource.name, avatar: mvpSource.avatar ? resolveMediaUrl(mvpSource.avatar) : null }
      : null,
    mvpPending
  };
}

function getMatchTarget(match: ProfileHistoryItem) {
  return match.status === "finished"
    ? `/matches/${match.id}/finished`
    : match.status === "live"
      ? `/matches/${match.id}/live`
      : `/matches/${match.id}`;
}

export function Profile() {
  const navigate = useNavigate();
  const { me, settings, refreshMe } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [rating, setRating] = useState<ProfileRating | null>(null);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(
    searchParams.get("view") === "rank"
  );
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [resetToTelegramAvatar, setResetToTelegramAvatar] = useState(false);
  const [profileThemeId, setProfileThemeId] = useState(() => getStoredProfileThemeId());
  const [saving, setSaving] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [avatarGrayscale, setAvatarGrayscale] = useState(() => getStoredAvatarGrayscale());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editOpen = searchParams.get("view") === "edit";

  useEffect(() => {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          stats?: ProfileStats;
          rating?: ProfileRating | null;
          history?: ProfileHistoryItem[];
        };
        if (parsed.stats) setStats(parsed.stats);
        if (parsed.rating !== undefined) setRating(parsed.rating);
        if (parsed.history) setHistory(parsed.history);
      } catch {
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
    }
    Promise.allSettled([getProfile(), fetchLobbies()]).then((results) => {
      const [profileResult, lobbiesResult] = results;
      if (profileResult.status === "fulfilled") {
        setStats(profileResult.value?.stats || emptyStats);
        setRating(profileResult.value?.rating || null);
        setHistory(profileResult.value?.history || []);
        localStorage.setItem(
          PROFILE_CACHE_KEY,
          JSON.stringify({
            stats: profileResult.value?.stats || emptyStats,
            rating: profileResult.value?.rating || null,
            history: profileResult.value?.history || []
          })
        );
      } else {
        setError(formatApiError(profileResult.reason));
      }
      if (lobbiesResult.status === "fulfilled") {
        const defaultLobby =
          lobbiesResult.value?.lobbies?.find((item) => item.id === lobbiesResult.value?.default_context_id) ||
          lobbiesResult.value?.lobbies?.[0] ||
          null;
        setLeaderboardEnabled(defaultLobby?.config?.leaderboard_enabled ?? true);
      }
    });
  }, []);

  useEffect(() => {
    const nextOpen = searchParams.get("view") === "rank";
    setLeaderboardOpen(nextOpen);
  }, [searchParams]);

  useEffect(() => {
    const theme = applyProfileTheme(profileThemeId);
    document.documentElement.classList.toggle("dark", isDarkProfileTheme(theme.id));
  }, [profileThemeId]);

  useEffect(() => {
    const incomingTheme = settings?.theme || "";
    if (!incomingTheme) return;
    setProfileThemeId(normalizeProfileThemeId(incomingTheme));
  }, [settings?.theme]);

  useEffect(() => {
    if (editOpen) {
      setDraftName(me?.custom_name || me?.tg_name || "");
      setDraftFile(null);
      setResetToTelegramAvatar(false);
      setAvatarGrayscale(settings?.avatar_grayscale ?? getStoredAvatarGrayscale());
    }
  }, [editOpen, me?.custom_name, me?.tg_name, settings?.avatar_grayscale]);

  const handleLeaderboardOpenChange = (open: boolean) => {
    if (open) {
      if (!leaderboardEnabled) {
        setError("Лидерборд отключен для текущего лобби");
        return;
      }
      setSearchParams({ view: "rank" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    if (!open) return;
    setLeaderboardLoading(true);
    getLeaderboard()
      .then((data) => {
        const enabled = data?.enabled ?? true;
        setLeaderboardEnabled(enabled);
        setLeaderboardItems(enabled ? data?.items || [] : []);
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLeaderboardLoading(false));
  };

  const openEdit = () => setSearchParams({ view: "edit" }, { replace: true });
  const closeEdit = () => setSearchParams({}, { replace: true });

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      let uploadedUrl: string | null = null;
      const nextName = draftName.trim();
      const hasCustomName = Boolean(me?.custom_name);
      if (draftFile) {
        const result = await uploadAvatar(draftFile);
        uploadedUrl = result?.url || null;
      }
      if ((nextName && nextName !== (me?.custom_name || me?.tg_name)) || (!nextName && hasCustomName)) {
        await patchMe({ custom_name: nextName || null });
      }
      const nextThemeId = profileThemeId;
      const currentThemeId = normalizeProfileThemeId(settings?.theme || getStoredProfileThemeId());
      const currentAvatarGrayscale = settings?.avatar_grayscale ?? getStoredAvatarGrayscale();
      const hasThemeChange = nextThemeId !== currentThemeId;
      const hasGrayscaleChange = avatarGrayscale !== currentAvatarGrayscale;
      if (hasThemeChange || hasGrayscaleChange) {
        await patchSettings({
          avatar_grayscale: avatarGrayscale,
          theme: nextThemeId
        });
        persistAvatarGrayscale(avatarGrayscale);
      }
      if (resetToTelegramAvatar) {
        await patchMe({ custom_avatar: null });
        localStorage.removeItem("avatar_version");
        setAvatarOverride(null);
      }
      if (uploadedUrl) {
        const stamp = Date.now();
        setAvatarOverride(`${uploadedUrl}?v=${stamp}`);
        localStorage.setItem("avatar_version", String(stamp));
      }
      await refreshMe();
      setSearchParams({}, { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const orderedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const aDate = new Date(a.finished_at || a.scheduled_at || a.created_at).getTime();
      const bDate = new Date(b.finished_at || b.scheduled_at || b.created_at).getTime();
      return bDate - aDate;
    });
  }, [history]);

  const profileMatches = useMemo(
    () => orderedHistory.map((match) => buildProfileMatch(match, me?.tg_id ?? null)),
    [orderedHistory, me?.tg_id]
  );

  const latestMatches = useMemo(() => profileMatches.slice(0, 6), [profileMatches]);
  const ratingValue = useMemo(() => {
    if (!rating || Number.isNaN(rating.global)) return null;
    return rating.global;
  }, [rating]);
  const ratingDelta = rating?.last_delta ?? null;

  const profileName = (me?.custom_name || me?.tg_name || "PLAYER").toUpperCase();
  const profileAvatar = avatarOverride || me?.custom_avatar || me?.tg_avatar || null;
  const isAdmin = Boolean(me?.is_admin);
  const rootClass = "min-h-screen pb-10";
  const rootStyle = {
    fontFamily: "Inter, sans-serif",
    background: "var(--bg-page, #050505)",
    color: "var(--text-main, #ffffff)"
  };

  return (
    <div className={rootClass} style={rootStyle}>
      {leaderboardOpen ? (
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10" />
            <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">RANK</div>
            <div className="h-10 w-10" />
          </div>
          {leaderboardLoading ? (
            <div className="text-sm text-zinc-500">Loading...</div>
          ) : !leaderboardEnabled ? (
            <div className="text-sm text-zinc-500">Leaderboard disabled for this lobby</div>
          ) : leaderboardItems.length === 0 ? (
            <div className="text-sm text-zinc-500">No data</div>
          ) : (
            <LeaderboardView items={leaderboardItems} meTgId={me?.tg_id ?? null} />
          )}
        </main>
      ) : editOpen ? (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10" />
            <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">EDIT</div>
            <div className="h-10 w-10" />
          </div>

          <div className="flex flex-col gap-4">
            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Profile</div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-xl border-2 overflow-hidden flex items-center justify-center text-[11px] font-black"
                  style={{
                    borderColor: "var(--border-main)",
                    background: "var(--bg-contrast)",
                    color: "var(--text-contrast)"
                  }}
                >
                  {draftFile ? "NEW" : getInitials(profileName)}
                </div>
                <div className="flex-1">
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Name"
                    className="h-9 bg-transparent border-0 px-0 text-2xl font-black uppercase tracking-tight text-current placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setDraftFile(file);
                    if (file) setResetToTelegramAvatar(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  Avatar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftFile(null);
                    setResetToTelegramAvatar(true);
                  }}
                  className={`h-9 px-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform ${
                    resetToTelegramAvatar ? "opacity-100" : "opacity-70"
                  }`}
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  TG AVA
                </button>
              </div>
            </div>

            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Light Themes</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PROFILE_THEMES.slice(0, 5).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setProfileThemeId(theme.id)}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 transition-transform active:scale-[0.99] ${
                      profileThemeId === theme.id ? "shadow-[0_0_0_2px_var(--border-main)]" : ""
                    }`}
                    style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">{theme.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-5 rounded-lg border"
                        style={{
                          background: theme.colors["--bg-contrast"],
                          borderColor: theme.colors["--border-main"]
                        }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-lg border"
                        style={{
                          background: theme.colors["--bg-surface"],
                          borderColor: theme.colors["--border-main"]
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Dark Themes</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PROFILE_THEMES.slice(5).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setProfileThemeId(theme.id)}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 transition-transform active:scale-[0.99] ${
                      profileThemeId === theme.id ? "shadow-[0_0_0_2px_var(--border-main)]" : ""
                    }`}
                    style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">{theme.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-5 rounded-lg border"
                        style={{
                          background: theme.colors["--bg-contrast"],
                          borderColor: theme.colors["--border-main"]
                        }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-lg border"
                        style={{
                          background: theme.colors["--bg-surface"],
                          borderColor: theme.colors["--border-main"]
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Аватарки</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarGrayscale(true)}
                  className={`h-10 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform ${
                    avatarGrayscale ? "opacity-100" : "opacity-70"
                  }`}
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  Ч/Б ON
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarGrayscale(false)}
                  className={`h-10 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform ${
                    !avatarGrayscale ? "opacity-100" : "opacity-70"
                  }`}
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  COLOR
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-10 rounded-xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
                style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                onClick={handleSaveProfile}
                disabled={saving}
                type="button"
              >
                Save
              </button>
              <button
                className="h-10 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
                style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                onClick={closeEdit}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-2">
          {error ? <div className="text-xs text-red-500">{error}</div> : null}

          <ProfileCard
            name={profileName}
            avatarUrl={profileAvatar}
            rating={ratingValue}
            ratingDelta={ratingDelta}
            badgeLabel={isAdmin ? "ADMIN" : "PRO"}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--bg-contrast)] text-[color:var(--text-contrast)] font-black uppercase tracking-tight shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              onClick={openEdit}
              type="button"
            >
              <Edit2 className="h-5 w-5" strokeWidth={3} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => handleLeaderboardOpenChange(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-surface)] text-[color:var(--text-main)] font-black uppercase tracking-tight disabled:opacity-40"
              type="button"
              disabled={!leaderboardEnabled}
            >
              <Trophy className="h-5 w-5" strokeWidth={3} />
              <span>Rank</span>
            </button>
          </div>
          {isAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-page)] text-[color:var(--text-main)] font-black uppercase tracking-widest text-[10px]"
              type="button"
            >
              Admin
            </button>
          ) : null}

          <StatsGrid stats={stats} />
          <MatchesList matches={latestMatches} history={orderedHistory} />
          
        </main>
      )}

    </div>
  );
}
export function ProfileCard({
  name,
  avatarUrl,
  rating,
  ratingDelta,
  badgeLabel
}: {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  ratingDelta: number | null;
  badgeLabel: string;
}) {
  const ratingText = rating === null ? "—" : rating.toFixed(0);
  const isPositive = ratingDelta !== null && ratingDelta >= 0;
  const nameWrapRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLHeadingElement | null>(null);
  const [nameScale, setNameScale] = useState(1);

  useEffect(() => {
    const wrap = nameWrapRef.current;
    const text = nameRef.current;
    if (!wrap || !text) return;
    const wrapWidth = wrap.clientWidth;
    const textWidth = text.scrollWidth;
    if (!wrapWidth || !textWidth) return;
    const maxScale = 1.25;
    const nextScale = Math.min(maxScale, wrapWidth / textWidth);
    setNameScale(nextScale);
  }, [name]);

  return (
    <div className="w-full aspect-[3/4] bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-[1.5rem] relative overflow-hidden group mt-4">
      <div className="absolute inset-0 p-4 flex flex-col z-0 pointer-events-none select-none overflow-hidden leading-none">
        <h1 className="text-[6.5rem] font-black uppercase text-[color:var(--text-main)] opacity-10 break-all tracking-tighter leading-[0.8]">
          {name}
        </h1>
      </div>

      <div
        className="absolute inset-0 z-10 top-16 bottom-24 mx-4 rounded-2xl overflow-hidden border-[2px] shadow-2xl group"
        style={{ borderColor: "#ffffff" }}
      >
        {avatarUrl ? (
          <img
            src={resolveMediaUrl(avatarUrl)}
            alt={name}
            className="w-full h-full object-cover filter contrast-125 saturate-0 brightness-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--bg-contrast)] text-5xl font-black text-[color:var(--text-contrast)]">
            {getInitials(name)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-3 h-24 items-end">
        <div className="w-1/2 bg-[var(--bg-contrast)] rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden h-full text-[color:var(--text-contrast)]">
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-5xl font-black tracking-tighter leading-none">{ratingText}</span>
          </div>
          <div className="z-10 mt-auto">
            <span className="block text-[10px] font-black uppercase leading-none">Global</span>
            <span className="block text-[10px] font-black uppercase opacity-60 leading-none">Rating</span>
          </div>
          <div className="absolute top-4 right-4 text-[color:var(--text-contrast)] bg-black/20 rounded-lg p-1">
            {isPositive ? (
              <TrendingUp className="h-4 w-4" strokeWidth={4} />
            ) : (
              <TrendingDown className="h-4 w-4" strokeWidth={4} />
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col justify-end items-end h-full pb-1 min-w-0">
          <div ref={nameWrapRef} className="w-full overflow-hidden flex justify-end">
            <h2
              ref={nameRef}
              className="text-5xl font-black text-[color:var(--text-main)] uppercase italic tracking-tighter leading-none text-right whitespace-nowrap inline-block"
              style={{ transform: `scale(${nameScale})`, transformOrigin: "right bottom", willChange: "transform" }}
            >
              {name}
            </h2>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="bg-[var(--bg-contrast)] text-[color:var(--text-contrast)] text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider rounded-[2px]">
              {badgeLabel}
            </div>
            <span className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest drop-shadow-md">#10</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: ProfileStats }) {
  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-4 px-1">
        <h2 className="font-black text-xl italic uppercase tracking-tighter leading-none">Statistics</h2>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg-contrast)] rounded-[1.25rem] p-4 flex flex-col justify-between h-36 relative overflow-hidden group shadow-[0_0_20px_rgba(255,255,255,0.1)] text-[color:var(--text-contrast)]">
            <div className="flex justify-between items-start">
              <span className="font-black text-[10px] uppercase tracking-[0.2em] border-b border-black/10 pb-1 opacity-60">
                Goals
              </span>
              <div className="opacity-30">
                <Zap className="h-4 w-4" strokeWidth={3} />
              </div>
            </div>
            <span className="font-black text-[5rem] tracking-tighter leading-[0.8] -ml-1">{stats.goals}</span>
          </div>

          <div className="bg-[var(--bg-surface)] border border-zinc-800 rounded-[1.25rem] p-4 flex flex-col justify-between h-36 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="font-black text-zinc-500 text-[10px] uppercase tracking-[0.2em] border-b border-[color:var(--border-main)]/5 pb-1">
                Assists
              </span>
            </div>
            <span className="absolute bottom-4 left-4 font-black text-[5rem] text-[color:var(--text-main)] tracking-tighter leading-[0.8] -ml-1">
              {stats.assists}
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-zinc-800 p-4 rounded-[1.25rem] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]">
              <Trophy className="h-4 w-4" strokeWidth={3} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-[color:var(--text-main)] text-sm uppercase tracking-wider">MVP Awards</span>
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Match Best Player</span>
            </div>
          </div>
          <span className="font-black text-3xl text-[color:var(--text-main)] tracking-tighter">{stats.mvp}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div
            className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center justify-center h-20 border-[1px]"
            style={{ borderColor: "var(--border-main)" }}
          >
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Games</span>
            <span className="font-black text-2xl text-[color:var(--text-main)] leading-none">{stats.matches}</span>
          </div>
          <div
            className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center justify-center h-20 border-[2px] shadow-lg shadow-white/5"
            style={{ borderColor: "var(--border-main)" }}
          >
            <span className="text-[9px] font-bold text-[color:var(--text-main)] uppercase tracking-widest mb-0.5">Wins</span>
            <span className="font-black text-2xl text-[color:var(--text-main)] leading-none">{stats.wins}</span>
          </div>
          <div
            className="bg-[var(--bg-surface)] rounded-2xl p-3 flex flex-col items-center justify-center h-20 border-[1px]"
            style={{ borderColor: "var(--border-main)" }}
          >
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Loss</span>
            <span className="font-black text-2xl text-zinc-500 leading-none">{stats.losses}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchesList({ matches, history }: { matches: ProfileMatch[]; history: ProfileHistoryItem[] }) {
  if (!matches.length) return null;

  const [latestMatch, ...previousMatches] = matches;
  const latestSource = history.find((item) => item.id === latestMatch.id);
  const latestTarget = latestSource ? getMatchTarget(latestSource) : undefined;

  return (
    <div className="w-full mt-6">
      <HeroMatchCard match={latestMatch} target={latestTarget} />

      <div className="flex items-end justify-between mb-2 mt-6 px-1">
        <h2 className="font-black text-lg text-zinc-400 italic uppercase tracking-tighter leading-none">History</h2>
        <button className="text-[9px] font-bold text-zinc-600 hover:text-[color:var(--text-main)] transition-colors uppercase">
          View All
        </button>
      </div>

      <div className="flex flex-col">
        {previousMatches.map((match) => {
          const source = history.find((item) => item.id === match.id);
          const target = source ? getMatchTarget(source) : undefined;
          return <CompactMatchRow key={match.id} match={match} target={target} />;
        })}
      </div>
    </div>
  );
}

function HeroMatchCard({ match, target }: { match: ProfileMatch; target?: string }) {
  const isWin = match.result === "WIN";
  const borderColor = isWin ? "border-[var(--border-main)]" : "border-zinc-800";
  const cardStyle = isWin ? "bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]" : "bg-[var(--bg-surface)] text-[color:var(--text-main)]";

  return (
    <div className="w-full mb-3 mt-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-black text-[color:var(--text-main)] uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-lg bg-red-500 animate-pulse"></span>
          Latest Match Report
        </span>
        <span className="text-[9px] font-bold text-zinc-500 uppercase">{match.dateLabel}</span>
      </div>

      <MatchLink target={target}>
        <div className={`relative w-full border-2 ${borderColor} rounded-[1.5rem] p-4 flex flex-col gap-4 overflow-hidden group ${cardStyle}`}>
          {match.mvpPlayer || match.mvpPending ? (
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 pl-3 pr-4 py-1.5 rounded-b-2xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] z-20 flex items-center gap-3 ${
                isWin ? "bg-[var(--bg-page)] text-[color:var(--text-main)]" : "bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]"
              }`}
            >
              {match.mvpPlayer ? (
                <>
                  <div className="flex items-center gap-1.5 border-r-2 border-[color:var(--border-main)]/20 pr-3">
                    <Star className="h-4 w-4" strokeWidth={3} />
                    <span className="font-black text-[10px] uppercase tracking-widest">MVP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-[var(--bg-contrast)] p-[1px] ring-1 ring-[color:var(--border-main)]/20">
                      {match.mvpPlayer.avatar ? (
                        <img src={match.mvpPlayer.avatar} alt="MVP" className="w-full h-full rounded-[6px] object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-[6px] bg-[var(--bg-contrast)] flex items-center justify-center text-[8px] font-black text-[color:var(--text-contrast)]">
                          {getInitials(match.mvpPlayer.name)}
                        </div>
                      )}
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-tight">{match.mvpPlayer.name}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" strokeWidth={3} />
                  <span className="font-black text-[10px] uppercase tracking-widest opacity-80">Voting</span>
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-1">
            <div className="flex flex-col items-start gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">My Team</span>
              <AvatarStack members={match.myTeam} align="left" />
            </div>

            <div className="flex flex-col items-center pt-2">
          <div className="flex items-center gap-1">
            <span className={`text-4xl font-black ${isWin ? "" : "text-zinc-400"}`}>
              {match.scoreMyTeam}
            </span>
            <span className="text-zinc-700 text-2xl font-black">:</span>
            <span className={`text-4xl font-black ${isWin ? "opacity-70" : "text-[color:var(--text-main)]"}`}>
              {match.scoreOpponent}
            </span>
          </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border mt-1 ${isWin ? "border-black text-[color:var(--text-contrast)]" : "border-zinc-700 text-zinc-500"}`}>
                {match.result}
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Opponent</span>
              <AvatarStack members={match.opponentTeam} align="right" />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 mt-1 border-[color:var(--border-main)]/10">
            <span className={`font-black text-sm uppercase italic truncate max-w-[150px] ${isWin ? "" : "text-[color:var(--text-main)]"}`}>
              VS {match.opponent}
            </span>
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isWin ? "bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]" : "bg-[var(--bg-surface)] text-[color:var(--text-main)] border-2 border-[var(--border-main)]"}`}>
              <ChevronRight className="h-6 w-6" strokeWidth={3} />
            </div>
          </div>
        </div>
      </MatchLink>
    </div>
  );
}

function CompactMatchRow({ match, target }: { match: ProfileMatch; target?: string }) {
  const isWin = match.result === "WIN";
  const isDraw = match.result === "DRAW";

  let resultColor = "text-zinc-500";
  if (isWin) resultColor = "text-[color:var(--text-main)]";
  if (isDraw) resultColor = "text-zinc-400";

  return (
    <MatchLink target={target}>
      <div className="w-full h-14 flex items-center justify-between border-b border-zinc-800 px-1 hover:bg-[color:var(--bg-contrast)]/5 transition-colors group">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 flex items-center justify-center rounded border-2 font-black text-[10px] uppercase ${isWin ? "border-[var(--border-main)] bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]" : "border-zinc-800 bg-transparent text-zinc-600"}`}>
            {match.result.substring(0, 1)}
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[12px] font-black text-[color:var(--text-main)] uppercase italic tracking-tight">{match.opponent}</span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wide">{match.dateLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-lg font-black italic ${resultColor}`}>
            {match.scoreMyTeam}:{match.scoreOpponent}
          </span>
          <div className="text-zinc-700 group-hover:text-[color:var(--text-main)] transition-colors">
            <ChevronRight className="h-6 w-6" strokeWidth={3} />
          </div>
        </div>
      </div>
    </MatchLink>
  );
}

function AvatarStack({ members, align }: { members: { name: string; avatar: string | null }[]; align: "left" | "right" }) {
  const display = members.slice(0, 5);
  return (
    <div className={`flex items-center ${align === "right" ? "flex-row-reverse" : "flex-row"}`}>
      {display.map((member, index) => {
        const offsetClass = align === "left" ? "-ml-2 first:ml-0" : "-mr-2 first:mr-0";
        return (
          <div
            key={`${member.name}-${index}`}
            style={{
              zIndex: 10 - index,
              borderRadius: "0.5rem",
              boxShadow: "0 0 0 2px var(--bg-page)"
            }}
            className={`w-8 h-8 rounded-lg border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] overflow-hidden ${offsetClass} relative`}
          >
            {member.avatar ? (
              <img
                src={member.avatar}
                alt={member.name}
                className="w-full h-full object-cover rounded-lg"
                style={{ borderRadius: "0.5rem" }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-[10px] font-bold"
                style={{ color: "var(--text-contrast)" }}
              >
                {getInitials(member.name)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardView({ items, meTgId }: { items: LeaderboardEntry[]; meTgId: number | null }) {
  const top = items.slice(0, 3);
  const tableItems = items;
  const myIndex = meTgId ? items.findIndex((entry) => entry.tg_id === meTgId) : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myEntry = myIndex >= 0 ? items[myIndex] : null;

  const podium = [
    { place: 2, entry: top[1], height: "h-[85%]", order: "order-1" },
    { place: 1, entry: top[0], height: "h-full", order: "order-2" },
    { place: 3, entry: top[2], height: "h-[70%]", order: "order-3" }
  ];

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex items-end justify-between gap-1 h-[460px] w-full px-1">
        {podium.map((slot) => {
          const entry = slot.entry;
          const isWinner = slot.place === 1;
          return (
            <div key={`leaderboard-${slot.place}`} className={`flex-1 flex flex-col ${slot.order} ${slot.height} transition-all duration-700 ease-out`}>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className={`font-black text-[10px] tracking-[0.2em] ${isWinner ? "text-[color:var(--text-main)]" : "text-zinc-600"}`}>
                  {isWinner ? "TOP_ONE" : `TIER_0${slot.place}`}
                </span>
                {isWinner ? <Star className="h-4 w-4" strokeWidth={3} fill="currentColor" /> : null}
              </div>

              <div className={`flex-1 flex flex-col items-center justify-between p-2 rounded-2xl relative overflow-hidden border-2 ${isWinner ? "bg-[var(--bg-contrast)] border-[var(--border-main)] text-[color:var(--text-contrast)]" : "bg-[var(--bg-surface)] border-zinc-800 text-[color:var(--text-main)]"}`}>
                <div className={`w-full aspect-square rounded-xl overflow-hidden border-2 mb-2 ${isWinner ? "border-black/20" : "border-zinc-700"}`}>
                  {entry?.avatar ? (
                    <img src={resolveMediaUrl(entry.avatar)} alt={entry?.name || "Player"} className={`w-full h-full object-cover ${!isWinner ? "grayscale contrast-125 brightness-75" : ""}`} />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-2xl font-black ${isWinner ? "text-[color:var(--text-contrast)]" : "text-[color:var(--text-main)]"}`}>
                      {entry?.name ? entry.name.slice(0, 2).toUpperCase() : "--"}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center text-center w-full z-10 px-1 py-2">
                  <h3 className={`font-black text-xs uppercase tracking-tighter leading-none mb-1 w-full truncate ${isWinner ? "text-[color:var(--text-contrast)] italic" : "text-[color:var(--text-main)]"}`}>
                    {entry?.name || "—"}
                  </h3>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${isWinner ? "text-[color:var(--text-contrast)] opacity-60" : "text-zinc-500"}`}>
                    {entry ? entry.rating.toFixed(0) : "0"} <span className="text-[7px]">PTS</span>
                  </div>
                </div>

                <div className="mt-auto w-full flex justify-center pb-2">
                  <span className={`font-black text-6xl leading-[0.7] tracking-tighter select-none ${isWinner ? "text-[color:var(--text-contrast)] opacity-10" : "text-zinc-800/50"}`}>
                    {slot.place}
                  </span>
                </div>

                <div className={`absolute top-0 right-0 p-1 opacity-20 ${isWinner ? "text-[color:var(--text-contrast)]" : "text-zinc-600"}`}>
                  <div className="w-2 h-2 border-r-2 border-t-2"></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-black text-2xl italic uppercase tracking-tighter text-[color:var(--text-main)]">The Pursuit</h2>
          <span
            className="bg-[var(--bg-surface)] font-black text-[9px] px-2 py-1 rounded uppercase tracking-[0.2em] border border-[color:var(--border-main)] opacity-60"
            style={{ color: "var(--text-main)" }}
          >
            Season 04
          </span>
        </div>

        <div className="flex flex-col rounded-2xl overflow-hidden border-2 border-[color:var(--border-main)] bg-[color:var(--bg-surface)]/50">
          {tableItems.map((entry, index) => (
            <div
              key={`leaderboard-row-${entry.tg_id ?? index}`}
              className="flex items-center py-4 px-5 border-b-2 border-[color:var(--border-main)] last:border-0 hover:bg-[color:var(--bg-contrast)]/5 active:bg-[color:var(--bg-contrast)]/10 transition-all group"
            >
              <span
                className="w-10 font-black text-xl italic transition-colors opacity-60 group-hover:opacity-100"
                style={{ color: "var(--text-main)" }}
              >
                {index + 1}
              </span>
              <div className="flex-1 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-lg border-2 overflow-hidden shrink-0"
                  style={{ background: "var(--bg-contrast)", borderColor: "var(--border-main)" }}
                >
                  {entry.avatar ? (
                    <img src={resolveMediaUrl(entry.avatar)} alt={entry.name} className="w-full h-full object-cover grayscale opacity-80" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-black"
                      style={{ color: "var(--text-contrast)" }}
                    >
                      {entry.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-black text-[color:var(--text-main)] text-sm uppercase tracking-tight italic mb-1">{entry.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md border border-[color:var(--border-main)]/50 px-1.5 py-[2px] text-[8px] font-black uppercase tracking-widest opacity-80">
                      И {entry.games}
                    </span>
                    <span className="rounded-md border border-[color:var(--border-main)]/50 px-1.5 py-[2px] text-[8px] font-black uppercase tracking-widest opacity-80">
                      В {entry.wins}
                    </span>
                    <span className="rounded-md border border-[color:var(--border-main)]/50 px-1.5 py-[2px] text-[8px] font-black uppercase tracking-widest opacity-80">
                      П {entry.losses}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end leading-none">
                <span className="font-black text-lg tracking-tighter italic" style={{ color: "var(--text-main)" }}>
                  {entry.rating.toFixed(0)}
                </span>
                <span
                  className="text-[8px] font-black uppercase tracking-widest mt-1 opacity-50"
                  style={{ color: "var(--text-main)" }}
                >
                  Rating
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-[color:var(--bg-surface)]/80 backdrop-blur-xl border-t-2 border-[color:var(--border-main)]/20 flex items-center justify-between rounded-t-[2rem]">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[color:var(--text-main)] opacity-60 uppercase tracking-widest">
            Your Current Position
          </span>
          <span className="text-2xl font-black text-[color:var(--text-main)] italic uppercase tracking-tighter">
            {myRank ? `#${myRank}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block font-black text-xl text-[color:var(--text-main)] leading-none tracking-tighter">
              {myEntry ? myEntry.rating.toFixed(0) : "--"}
            </span>
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Rating</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-contrast)] flex items-center justify-center text-[color:var(--text-contrast)]">
            <Star className="h-4 w-4" strokeWidth={3} fill="currentColor" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchLink({ target, children }: { target?: string; children: React.ReactNode }) {
  if (!target) return <div>{children}</div>;
  return (
    <a href={`#${target}`} className="block">
      {children}
    </a>
  );
}






