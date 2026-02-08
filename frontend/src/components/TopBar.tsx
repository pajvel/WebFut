import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { resolveMediaUrl } from "../lib/media";
import { cn } from "../lib/utils";

type TopBarProps = {
  title?: string;
  avatarUrl?: string | null;
};

const rootPaths = new Set(["/", "/matches"]);

export function TopBar({ title, avatarUrl }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isProfile = location.pathname === "/profile";
  const isMatchPage = location.pathname.startsWith("/matches/") && location.pathname !== "/matches";
  const profileView = searchParams.get("view");
  const hasProfileSubView = isProfile && (profileView === "rank" || profileView === "edit");
  const canGoBack = hasProfileSubView || !rootPaths.has(location.pathname);
  const avatarVersion = typeof window !== "undefined" ? localStorage.getItem("avatar_version") : null;
  const resolvedAvatar = avatarUrl ? resolveMediaUrl(avatarUrl) : null;
  const avatarSrc =
    resolvedAvatar && avatarVersion
      ? `${resolvedAvatar}${resolvedAvatar.includes("?") ? "&" : "?"}v=${avatarVersion}`
      : resolvedAvatar;
  const handleBack = () => {
    if (hasProfileSubView) {
      navigate("/profile", { replace: true });
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

  const now = new Date();
  const storedStatus = typeof window !== "undefined" ? localStorage.getItem("match_status") : null;
  const statusLabel = location.pathname.includes("/live")
    ? "LIVE"
    : location.pathname.includes("/finished")
      ? "FINISHED"
      : storedStatus === "generating"
        ? "GENERATING"
        : storedStatus === "created"
          ? "WAITING"
          : "WAITING";
  const statusDot =
    statusLabel === "LIVE"
      ? "bg-red-600 animate-pulse"
      : statusLabel === "GENERATING"
        ? "bg-green-500 animate-pulse"
        : "bg-zinc-400";
  const dateLabel = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  const timeLabel = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

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
            <div className="w-24 text-right">
              <div className="flex flex-col">
                <div className="flex items-center justify-end gap-1">
                  <div className={`w-1 h-1 rounded-full ${statusDot}`} />
                  <span className="text-[10px] font-black tracking-[0.2em] text-[var(--text-main)] italic uppercase">
                    {statusLabel}
                  </span>
                </div>
                <div className="text-[11px] font-black text-[var(--text-main)] leading-none uppercase tracking-tight">
                  {dateLabel}
                </div>
                <div className="text-[11px] font-black text-[var(--text-main)] leading-none uppercase tracking-tight">
                  {timeLabel}
                </div>
              </div>
            </div>
          ) : isProfile ? (
            <span className="font-black italic text-lg uppercase tracking-tighter text-[color:var(--text-main)]">
              {rightLabel}
            </span>
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
