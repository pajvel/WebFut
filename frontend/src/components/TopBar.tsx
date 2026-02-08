import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { resolveMediaUrl } from "../lib/media";
import { cn } from "../lib/utils";
import { getMatch } from "../lib/api";
import type { MatchSummary } from "../lib/types";
import { formatVenueLabel } from "../lib/venue";

type TopBarProps = {
  title?: string;
  avatarUrl?: string | null;
};

const rootPaths = new Set(["/", "/matches"]);

export function TopBar({ title, avatarUrl }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [matchMeta, setMatchMeta] = useState<MatchSummary | null>(null);

  const isProfile = location.pathname === "/profile";
  const isAdmin = location.pathname.startsWith("/admin");
  const isMatchPage = location.pathname.startsWith("/matches/") && location.pathname !== "/matches";
  const matchIdMatch = location.pathname.match(/^\/matches\/(\d+)(?:\/|$)/);
  const matchId = matchIdMatch ? Number(matchIdMatch[1]) : null;

  const profileView = searchParams.get("view");
  const hasProfileSubView = isProfile && (profileView === "rank" || profileView === "edit");
  const canGoBack = hasProfileSubView || !rootPaths.has(location.pathname);

  const avatarVersion = typeof window !== "undefined" ? localStorage.getItem("avatar_version") : null;
  const resolvedAvatar = avatarUrl ? resolveMediaUrl(avatarUrl) : null;
  const avatarSrc =
    resolvedAvatar && avatarVersion
      ? `${resolvedAvatar}${resolvedAvatar.includes("?") ? "&" : "?"}v=${avatarVersion}`
      : resolvedAvatar;

  useEffect(() => {
    let cancelled = false;

    if (!isMatchPage || !matchId || Number.isNaN(matchId)) {
      setMatchMeta(null);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        const result = await getMatch(matchId);
        if (!cancelled) setMatchMeta(result.match);
      } catch {
        if (!cancelled) setMatchMeta(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isMatchPage, matchId]);

  const handleBack = () => {
    if (hasProfileSubView) {
      navigate("/profile", { replace: true });
      return;
    }
    if (isAdmin) {
      navigate("/profile");
      return;
    }
    if (location.pathname.includes("/teams")) {
      window.dispatchEvent(new Event("teams-back"));
      return;
    }
    navigate("/matches");
  };

  const rightLabel = isProfile
    ? profileView === "rank"
      ? "RANK"
      : profileView === "edit"
        ? "EDIT"
        : "PROFILE"
    : title || "WEBFUT";

  const statusLabel = matchMeta
    ? matchMeta.status === "live"
      ? "LIVE"
      : matchMeta.status === "finished"
        ? "FINISHED"
        : matchMeta.status === "generating"
          ? "GENERATING"
          : "WAITING"
    : location.pathname.includes("/live")
      ? "LIVE"
      : location.pathname.includes("/finished")
        ? "FINISHED"
        : "WAITING";

  const statusDot =
    statusLabel === "LIVE"
      ? "bg-red-600 animate-pulse"
      : statusLabel === "GENERATING"
        ? "bg-green-500 animate-pulse"
        : "bg-zinc-400";

  const matchDateSource = matchMeta?.scheduled_at || matchMeta?.created_at || null;
  const matchDate = matchDateSource ? new Date(matchDateSource) : null;
  const hasValidMatchDate = Boolean(matchDate && !Number.isNaN(matchDate.getTime()));

  const dateLabel = hasValidMatchDate
    ? matchDate!.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
    : "--.--";
  const timeLabel = hasValidMatchDate
    ? matchDate!.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const venueLabel = formatVenueLabel(matchMeta?.venue);

  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--border-main)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex w-20 items-center justify-start">
          {canGoBack ? (
            <button
              type="button"
              onClick={handleBack}
              className={cn(
                "flex h-10 w-10 items-center justify-center border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 transition-transform",
                canGoBack ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[color:var(--text-main)] font-black italic text-xl tracking-tight leading-none uppercase">
            WEBFUT
          </h1>
        </div>

        <div className="flex w-20 items-center justify-end">
          {isMatchPage ? (
            <div className="w-28 text-right">
              <div className="flex flex-col">
                <div className="flex items-center justify-end gap-1">
                  <div className={`w-1 h-1 rounded-full ${statusDot}`} />
                  <span className="text-[10px] font-black tracking-[0.2em] text-[var(--text-main)] italic uppercase">
                    {statusLabel}
                  </span>
                </div>
                <div className="text-[11px] font-black text-[var(--text-main)] leading-none uppercase tracking-tight">
                  {timeLabel}
                </div>
                <div className="text-[11px] font-black text-[var(--text-main)] leading-none uppercase tracking-tight">
                  {dateLabel}
                </div>
                <div className="text-[10px] font-black text-[var(--text-main)]/70 leading-none uppercase tracking-tight truncate">
                  {venueLabel}
                </div>
              </div>
            </div>
          ) : isProfile ? (
            <span className="font-black italic text-lg uppercase tracking-tighter text-[color:var(--text-main)]">
              {rightLabel}
            </span>
          ) : isAdmin ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("admin-open-menu"))}
              aria-label="Меню админки"
              className="flex h-10 w-10 items-center justify-center border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 transition-transform overflow-hidden"
              style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              aria-label="Профиль"
              className="flex h-10 w-10 items-center justify-center border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 transition-transform overflow-hidden"
              style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="ME" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-[color:var(--text-main)]">
                  ME
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
