import { Link } from "react-router-dom";

import type { MatchParticipant, MatchSummary } from "../lib/types";
import { resolveMediaUrl } from "../lib/media";
import { useAppContext } from "../lib/app-context";
import { formatVenueLabel } from "../lib/venue";

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || parts[0]?.[1] || "";
  return `${first}${second}`.toUpperCase();
}

function mapAvatars(members: MatchParticipant[]) {
  return members.map((member) => ({
    name: member.name,
    avatar: resolveMediaUrl(member.avatar)
  }));
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function AvatarStack({ members, align }: { members: { name: string; avatar: string | null }[]; align: "left" | "right" }) {
  const total = members.length;
  const showAll = total <= 5;
  const visible = showAll ? members : members.slice(0, 4);
  const overflowCount = total > 5 ? total - 4 : 0;
  return (
    <div className={`flex items-center ${align === "right" ? "flex-row-reverse" : "flex-row"} overflow-hidden`}>
      {visible.map((member, index) => {
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
                style={{ borderRadius: "0.5rem", aspectRatio: "1 / 1" }}
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
      {!showAll && overflowCount > 0 ? (
        <div
          style={{
            zIndex: 0,
            borderRadius: "0.5rem",
            boxShadow: "0 0 0 2px var(--bg-page)"
          }}
          className={`w-8 h-8 rounded-lg border-2 border-[var(--border-main)] bg-[var(--bg-surface)] flex items-center justify-center text-[10px] font-black ${align === "left" ? "-ml-2" : "-mr-2"}`}
        >
          +{overflowCount}
        </div>
      ) : null}
    </div>
  );
}

export function MatchCard({ match }: { match: MatchSummary }) {
  const { me } = useAppContext();
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isLobby = match.status === "created";
  const isGenerating = match.status === "generating";

  const teamA = mapAvatars(match.team_a_members || []);
  const teamB = mapAvatars(match.team_b_members || []);
  const allPlayers = [...teamA, ...teamB];
  const mePlayed = Boolean(
    me?.tg_id &&
      [...(match.team_a_members || []), ...(match.team_b_members || [])].some((member) => member.tg_id === me.tg_id)
  );

  const mvpPlayer = match.mvp?.player ?? null;
  const mvpHasLeader = Boolean(match.mvp?.top_tg_id);
  const mvpPending = isFinished && !mvpPlayer && !mvpHasLeader;
  const mvpLeaderLabel = match.mvp?.top_tg_id ? `#${match.mvp.top_tg_id}` : "";

  const resultLabel = match.score_a === match.score_b ? "DRAW" : match.score_a > match.score_b ? "WIN" : "LOSS";
  const aWins = match.score_a > match.score_b;
  const bWins = match.score_b > match.score_a;
  const aScoreClass = isLive
    ? aWins
      ? "text-red-600 opacity-100 animate-pulse"
      : bWins
        ? "text-red-600 opacity-40"
        : "text-red-600 opacity-100 animate-pulse"
    : aWins
      ? "text-[color:var(--text-main)] opacity-100"
      : bWins
        ? "text-[color:var(--text-main)] opacity-40"
        : "text-[color:var(--text-main)] opacity-100";
  const bScoreClass = isLive
    ? bWins
      ? "text-red-600 opacity-100 animate-pulse"
      : aWins
        ? "text-red-600 opacity-40"
        : "text-red-600 opacity-100 animate-pulse"
    : bWins
      ? "text-[color:var(--text-main)] opacity-100"
      : aWins
        ? "text-[color:var(--text-main)] opacity-40"
        : "text-[color:var(--text-main)] opacity-100";

  const target =
    match.status === "finished"
      ? `/matches/${match.id}/finished`
      : match.status === "live"
        ? `/matches/${match.id}/live`
        : `/matches/${match.id}`;

  const statusLabel = isLive ? "LIVE" : isGenerating ? "GENERATING" : isLobby ? "WAITING" : "FINISHED";
  const statusColor = isLive ? "bg-red-500" : isGenerating ? "bg-green-500" : isLobby ? "bg-amber-500" : "bg-zinc-500";

  const opponentLabel = match.venue?.trim() ? formatVenueLabel(match.venue) : "MATCH";

  return (
    <div className="relative mb-6">
      <div
        className={`absolute top-0 right-6 -translate-y-1/2 px-2 py-1 rounded-md text-white text-[9px] font-black uppercase tracking-widest ${statusColor} z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]`}
      >
        {statusLabel}
      </div>
      <div className="relative w-full border-2 border-zinc-800 rounded-[1.5rem] p-4 flex flex-col gap-4 overflow-hidden group bg-[var(--bg-surface)] text-[color:var(--text-main)]">
      {mvpPlayer || mvpPending ? (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pl-3 pr-4 py-1.5 rounded-b-2xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] z-20 flex items-center gap-3 bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star h-4 w-4">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="font-black text-[10px] uppercase tracking-widest opacity-80">
              {mvpPlayer || mvpHasLeader ? "MVP" : "Voting"}
            </span>
          </div>
          {mvpPlayer || mvpHasLeader ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[var(--bg-contrast)] p-[1px] ring-1 ring-[color:var(--text-contrast)]">
                {mvpPlayer?.avatar ? (
                  <img src={resolveMediaUrl(mvpPlayer.avatar)} alt="MVP" className="w-full h-full rounded-[6px] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[6px] bg-[var(--bg-contrast)] flex items-center justify-center text-[8px] font-black text-[color:var(--text-contrast)]">
                    {mvpPlayer ? getInitials(mvpPlayer.name) : "MVP"}
                  </div>
                )}
              </div>
              <span className="font-black text-[10px] uppercase tracking-tight">
                {mvpPlayer ? mvpPlayer.name : mvpLeaderLabel}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-1 overflow-hidden gap-2">
        <div className="flex flex-col items-start gap-2 min-w-0 flex-1">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">My Team</span>
          <div className="max-w-[110px] overflow-hidden">
            {isLobby ? <AvatarStack members={allPlayers} align="left" /> : <AvatarStack members={teamA} align="left" />}
          </div>
        </div>

        <div className="flex flex-col items-center pt-2 shrink-0 w-[110px]">
          {!isLobby ? (
            <div className="flex items-center gap-1">
              <span className={`text-4xl font-black ${aScoreClass}`}>{match.score_a}</span>
              <span className="text-zinc-700 text-2xl font-black">:</span>
              <span className={`text-4xl font-black ${bScoreClass}`}>{match.score_b}</span>
            </div>
          ) : (
            <div className="h-10" />
          )}
          {isFinished && mePlayed ? (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border mt-1 border-zinc-700 text-zinc-500">
              {resultLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2 min-w-0 flex-1">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Opponent</span>
          {isLobby ? (
            <div className="h-10" />
          ) : (
            <div className="max-w-[110px] overflow-hidden">
              <AvatarStack members={teamB} align="right" />
            </div>
          )}
        </div>
      </div>

      <Link to={target} className="flex items-center justify-between border-t pt-3 mt-1 border-[color:var(--border-main)]/10">
        <div className="flex flex-col overflow-hidden">
          <span className="font-black text-sm uppercase italic truncate max-w-[150px] text-[color:var(--text-main)]">
            VS {opponentLabel}
          </span>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-bold text-[11px] uppercase text-[color:var(--text-main)] tracking-tight whitespace-nowrap">
              {formatTime(match.scheduled_at || match.created_at) || ""}
            </span>
            <div className="w-1 h-1 rounded-full bg-zinc-300" />
            <span className="font-bold text-[11px] uppercase text-zinc-500 tracking-tight truncate">
              {formatDate(match.scheduled_at || match.created_at) || ""}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right h-6 w-6">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </Link>
      </div>
    </div>
  );
}
