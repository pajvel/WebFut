import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import {
  generateTeams,
  getMatch,
  joinMatch,
  leaveMatch,
  payerRequest,
  payerRespond,
  payerSelect,
  spectateMatch,
  updateMemberPermissions
} from "../lib/api";
import { formatApiError } from "../lib/errors";
import type { MatchDetail, MatchMember } from "../lib/types";
import { StatusCard } from "../components/StatusCard";
import { resolveMediaUrl } from "../lib/media";
import { formatDateShortMsk, formatTimeMsk } from "../lib/datetime";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useMatText } from "../lib/mode18";
import { formatVenueLabel } from "../lib/venue";

function formatDate(value: string | null) {
  return formatDateShortMsk(value);
}

function formatTime(value: string | null) {
  return formatTimeMsk(value);
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || parts[0]?.[1] || "";
  return `${first}${second}`.toUpperCase();
}

function PlayerCard({
  player,
  size = "sm",
  showRoleBadge = false,
  showRating = true
}: {
  player: MatchMember;
  size?: "sm" | "lg";
  showRoleBadge?: boolean;
  showRating?: boolean;
}) {
  const isLarge = size === "lg";
  return (
    <div
      className={`relative flex items-center border-[1.5px] border-[var(--border-main)] rounded-xl w-full transition-all bg-[var(--bg-surface)] text-[var(--text-main)] ${
        isLarge ? "p-2 h-14" : "p-1 h-8"
      }`}
      style={{ boxShadow: "2px 2px 0px 0px var(--border-main)" }}
    >
      {player.avatar ? (
        <img
          src={resolveMediaUrl(player.avatar)}
          alt={player.name}
          className={`rounded-lg border border-[var(--border-main)] object-cover ${isLarge ? "w-10 h-10" : "w-6 h-6"}`}
        />
      ) : (
        <div
          className={`rounded-lg border border-[var(--border-main)] flex items-center justify-center font-black uppercase ${
            isLarge ? "w-10 h-10 text-[10px]" : "w-6 h-6 text-[8px]"
          }`}
          style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
        >
          {getInitials(player.name)}
        </div>
      )}
      <div className="ml-2 flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <div
            className={`font-black italic truncate uppercase tracking-tighter leading-none ${
              isLarge ? "text-sm" : "text-[10px]"
            }`}
          >
            {player.name}
          </div>
          {player.can_edit ? (
            <div className="shrink-0 px-1 rounded font-black text-[8px] uppercase tracking-tighter border border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]">
              ПРАВА
            </div>
          ) : null}
        </div>
        {isLarge && !player.can_edit ? (
          <div className="inline-block px-1 rounded font-black text-[8px] uppercase tracking-tighter border border-[var(--border-main)] bg-[var(--bg-page)] opacity-50 mt-1">
            РЕЙТИНГОВЫЙ
          </div>
        ) : null}
      </div>
      {showRoleBadge ? (
        <div
          className={`flex items-center justify-center border-2 border-[var(--border-main)] bg-[var(--bg-page)] ${
            isLarge ? "w-8 h-8 rounded-lg" : "w-6 h-6 rounded-md"
          }`}
          title={player.role === "spectator" ? "Зритель" : "Игрок"}
        >
          <span className={`font-black uppercase ${isLarge ? "text-[10px]" : "text-[8px]"}`}>
            {player.role === "spectator" ? "S" : "P"}
          </span>
        </div>
      ) : showRating ? (
        <div
          className={`px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border-2 border-[var(--border-main)] bg-[var(--bg-page)] ${
            isLarge ? "text-[10px]" : "text-[8px]"
          }`}
        >
          {player.rating ?? "--"}
        </div>
      ) : null}
    </div>
  );
}

export function MatchLobby() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [permissionTarget, setPermissionTarget] = useState<MatchMember | null>(null);

  const load = () => {
    if (!matchId) return;
    getMatch(Number(matchId))
      .then(setData)
      .catch((err) => setError(formatApiError(err)));
  };

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") return;
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || active.isContentEditable) {
          return;
        }
      }
      getMatch(Number(matchId))
        .then((result) => {
          if (alive) {
            if (result.match.status === "live") {
              navigate(`/matches/${matchId}/live`);
              return;
            }
            if (typeof window !== "undefined") {
              localStorage.setItem("match_status", result.match.status);
            }
            setData(result);
          }
        })
        .catch((err) => setError(formatApiError(err)));
    };
    tick();
    const interval = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [matchId]);

  useEffect(() => {
    if (!data) return;
  }, [data]);

  const myRole = useMemo(() => {
    if (!data) return null;
    return data.members.find((m) => m.tg_id === data.me.tg_id)?.role ?? null;
  }, [data]);
  const myMember = useMemo(
    () => data?.members.find((member) => member.tg_id === data?.me.tg_id) || null,
    [data]
  );

  const isOrganizer = !!(data && (data.me.is_admin || myMember?.role === "organizer"));
  const canPayerAction = isOrganizer;
  const payerInfo = data?.payments?.payer || null;
  const hasPayer = !!(payerInfo && payerInfo.payer_tg_id);
  const payerRequests = data?.payments?.requests || [];
  const hasRequested = !!(
    data && payerRequests.some((req) => req.tg_id === data.me.tg_id && req.status === "pending")
  );
  const isPayer = !!(payerInfo && payerInfo.payer_tg_id === data?.me.tg_id);
  const isParticipant = myRole === "player" || myRole === "organizer";
  const perPersonAmount = useMemo(() => {
    if (!data || !payerInfo || payerInfo.payer_amount == null || !payerInfo.payer_tg_id) return null;
    const splitTargets = data.members.filter(
      (member) =>
        (member.role === "player" || member.role === "organizer")
    ).length;
    if (splitTargets <= 0) return null;
    return payerInfo.payer_amount / splitTargets;
  }, [data, payerInfo]);
  const offerForMe = useMemo(
    () => payerRequests.find((req) => req.tg_id === data?.me.tg_id && req.status === "offered") || null,
    [payerRequests, data]
  );

  const handleJoin = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await joinMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleSpectate = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await spectateMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleLeave = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await leaveMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleCreateTeams = async () => {
    if (!matchId) return;
    try {
      await generateTeams(Number(matchId));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      navigate(`/matches/${matchId}/teams?generated=1`);
    }
  };

  const errorToast = error ? <StatusCard title={t("Ошибка")} message={error} onClose={() => setError(null)} /> : null;

  if (!data) {
    return (
      <>
        {errorToast}
        <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>
      </>
    );
  }

  if (data.match.status === "finished") {
    return <Navigate to={`/matches/${data.match.id}/finished`} replace />;
  }
  if (data.match.status === "live") {
    return <Navigate to={`/matches/${data.match.id}/live`} replace />;
  }

  const players = data.members.filter((member) => member.role !== "spectator");
  const spectators = data.members.filter((member) => member.role === "spectator");
  const currentTeams = data.team_current?.current_teams || null;
  const fallbackTeams = data.team_variants?.[0]?.teams || null;
  const teamsSource = currentTeams || fallbackTeams;
  const teamAIds = teamsSource?.A || [];
  const teamBIds = teamsSource?.B || [];
  const teamAPlayers = teamAIds
    .map((id) => players.find((p) => String(p.tg_id) === String(id)))
    .filter(Boolean) as MatchMember[];
  const teamBPlayers = teamBIds
    .map((id) => players.find((p) => String(p.tg_id) === String(id)))
    .filter(Boolean) as MatchMember[];
  const powerData = data.team_current?.power || data.team_variants?.[0]?.power || null;
  const teamAAvg = powerData?.avg_a ?? (teamAPlayers.length
    ? teamAPlayers.reduce((sum, member) => sum + Number(member.rating ?? 0), 0) / teamAPlayers.length
    : 0);
  const teamBAvg = powerData?.avg_b ?? (teamBPlayers.length
    ? teamBPlayers.reduce((sum, member) => sum + Number(member.rating ?? 0), 0) / teamBPlayers.length
    : 0);
  const strengthDiff = powerData?.d_hat ?? (teamAAvg - teamBAvg);
  const strengthLabel =
    Math.abs(strengthDiff) < 0.1
      ? "Баланс"
      : strengthDiff > 0
        ? `Сильнее TEAM A на ${Math.abs(strengthDiff).toFixed(1)}`
        : `Сильнее TEAM B на ${Math.abs(strengthDiff).toFixed(1)}`;
  const totalA = teamAAvg * (teamAPlayers.length || 1);
  const totalB = teamBAvg * (teamBPlayers.length || 1);
  const strengthPercent =
    totalA + totalB > 0
      ? Math.min(100, Math.max(0, (totalA / (totalA + totalB)) * 100))
      : 50;

  return (
    <>
      {errorToast}
      <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-page)] relative">
      <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-48">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <h2 className="font-black italic text-[var(--text-main)] uppercase text-xl leading-none tracking-tighter">
              {formatVenueLabel(data.match.venue)}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-xl text-center">
              <span className="font-black italic text-[10px] text-[var(--text-main)] uppercase tracking-tighter">TEAM A</span>
            </div>
            <div className="space-y-1.5">
              {teamAPlayers.length
                ? teamAPlayers.map((member) => (
                    <Link key={member.tg_id} to={matchId ? `/matches/${matchId}/players/${member.tg_id}` : "#"}>
                      <PlayerCard player={member} size="lg" showRating={false} />
                    </Link>
                  ))
                : [0, 1, 2].map((i) => (
                    <div
                      key={`empty-a-${i}`}
                      className="h-14 border-2 border-dashed border-[var(--border-main)] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center"
                    >
                      <span className="font-black italic text-[8px] text-[var(--text-main)] opacity-40 uppercase tracking-widest">ПУСТО</span>
                    </div>
                  ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-xl text-center">
              <span className="font-black italic text-[10px] text-[var(--text-main)] uppercase tracking-tighter">TEAM B</span>
            </div>
            <div className="space-y-1.5">
              {teamBPlayers.length
                ? teamBPlayers.map((member) => (
                    <Link key={member.tg_id} to={matchId ? `/matches/${matchId}/players/${member.tg_id}` : "#"}>
                      <PlayerCard player={member} size="lg" showRating={false} />
                    </Link>
                  ))
                : [0, 1, 2].map((i) => (
                    <div
                      key={`empty-b-${i}`}
                      className="h-14 border-2 border-dashed border-[var(--border-main)] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center"
                    >
                      <span className="font-black italic text-[8px] text-[var(--text-main)] opacity-40 uppercase tracking-widest">ПУСТО</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {data.match.status === "generating" ? (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-4 shadow-brutal">
            <div className="flex items-center justify-between mb-3">
              <span className="font-black italic uppercase text-[10px] tracking-widest text-[var(--text-main)] opacity-50">
                СИЛА КОМАНД
              </span>
              <span className="font-black text-[10px] uppercase text-[var(--text-main)]">{strengthLabel}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-black uppercase text-[var(--text-main)]">
              <span>TEAM A {teamAAvg ? teamAAvg.toFixed(0) : "--"}</span>
              <span>TEAM B {teamBAvg ? teamBAvg.toFixed(0) : "--"}</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full border-2 border-[var(--border-main)] bg-[var(--bg-page)] overflow-hidden">
              <div
                className="h-full bg-[var(--bg-contrast)]"
                style={{ width: `${strengthPercent}%` }}
              />
            </div>
            {data.team_current?.why_now_worse_text || data.team_variants?.[0]?.why_text ? (
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)] opacity-60">
                АНАЛИЗ:{" "}
                <span className="font-black text-[var(--text-main)]">
                  {data.team_current?.why_now_worse_text || data.team_variants?.[0]?.why_text}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {isParticipant ? (
          <div className="bg-[var(--bg-surface)] p-5 border-2 border-[var(--border-main)] rounded-[2.5rem] shadow-brutal">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <h3 className="font-black italic uppercase text-lg leading-none text-[var(--text-main)]">ПЛАТЕЛЬЩИК</h3>
                <span className="font-bold text-[8px] opacity-50 uppercase tracking-wider text-[var(--text-main)]">
                  {payerInfo?.payer_tg_id
                    ? `АКТИВНЫЙ: ${payerInfo.payer_fio || players.find((p) => p.tg_id === payerInfo.payer_tg_id)?.name || payerInfo.payer_tg_id}`
                    : "ОЖИДАЕТ ВЫБОРА"}
                </span>
                {perPersonAmount != null ? (
                  <span className="font-bold text-[8px] opacity-60 uppercase tracking-wider text-[var(--text-main)]">
                    С ЧЕЛОВЕКА: {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(perPersonAmount)}
                  </span>
                ) : null}
              </div>
              <span
                className={`px-2 py-1 rounded-lg border-2 border-[var(--border-main)] font-black text-[9px] uppercase tracking-tighter ${
                  payerInfo?.payer_tg_id ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]" : "bg-[var(--bg-page)] text-[var(--text-main)] opacity-50"
                }`}
              >
                {payerInfo?.payer_tg_id ? "ВЫБРАН" : "ОЖИДАНИЕ"}
              </span>
            </div>
            <button
              onClick={() => {
                if (!isOrganizer) {
                  if (!hasRequested) {
                    payerRequest(Number(matchId)).then(load).catch((err) => setError(formatApiError(err)));
                  }
                  return;
                }
                setShowPayerModal(true);
              }}
              className={`w-full py-4 font-black italic uppercase text-sm shadow-brutal active:shadow-none transition-all ${
                canPayerAction
                  ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                  : "bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)]"
              }`}
            >
              {canPayerAction ? "ВЫБРАТЬ ПЛАТЕЛЬЩИКА" : hasRequested ? "ЗАЯВКА ОТПРАВЛЕНА" : "ЗАПРОСИТЬ ПЛАТЕЛЬЩИКА"}
            </button>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black italic opacity-40 uppercase text-[10px] tracking-widest text-[var(--text-main)]">
              СПИСОК УЧАСТНИКОВ
            </h3>
            {myRole ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-main)] opacity-40">
                {myRole === "spectator" ? "ЗРИТЕЛЬ" : "ИГРОК"}
              </span>
            ) : null}
          </div>
          {!myRole && data.match.status !== "generating" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleJoin}
                className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-brutal"
                style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
              >
                Войти игроком
              </button>
              <button
                onClick={handleSpectate}
                className="h-12 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px]"
                style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
              >
                Войти зрителем
              </button>
            </div>
          ) : null}
          {myRole === "spectator" && data.match.status !== "generating" ? (
            <button
              onClick={handleJoin}
              className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] w-full shadow-brutal"
              style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
            >
              Войти игроком
            </button>
          ) : null}
          {!myRole && data.match.status === "generating" ? (
            <button
              onClick={handleSpectate}
              className="h-12 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] w-full"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
            >
              Войти зрителем
            </button>
          ) : null}
          {myRole ? (
            <button
              onClick={handleLeave}
              className="h-12 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] w-full"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
            >
              Выйти из матча
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {(data.match.status === "generating" ? spectators : data.members).map((member) => (
              <div
                key={member.tg_id}
                onClick={() => {
                  if (isOrganizer && member.role === "spectator") {
                    setPermissionTarget(member);
                    return;
                  }
                  navigate(matchId ? `/matches/${matchId}/players/${member.tg_id}` : `/players/${member.tg_id}`);
                }}
              >
                <PlayerCard player={member} showRoleBadge />
              </div>
            ))}
          </div>
        </div>
      </div>

      {isOrganizer ? (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)] z-40">
          <button
            onClick={() => {
              if (data.match.status === "generating") {
                navigate(`/matches/${data.match.id}/teams?generated=1`);
              } else {
                handleCreateTeams();
              }
            }}
            className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-4 font-black italic uppercase text-lg shadow-[6px_6px_0px_0px_var(--border-main)] border-2 border-[var(--border-main)] active:shadow-none transition-all"
          >
            {data.match.status === "generating" ? "ПРОДОЛЖИТЬ" : "СОЗДАТЬ КОМАНДЫ"}
          </button>
        </div>
      ) : null}

      {showPayerModal ? (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg-page)]">
          <div className="flex-none p-4 bg-[var(--bg-surface)] border-b-4 border-[var(--border-main)]">
            <div className="flex items-center justify-between">
              <h2 className="font-black italic uppercase text-xl text-[var(--text-main)]">ВЫБОР ПЛАТЕЛЬЩИКА</h2>
              <button
                onClick={() => setShowPayerModal(false)}
                className="w-10 h-10 border-2 border-[var(--border-main)] shadow-brutal-sm active:shadow-none flex items-center justify-center bg-[var(--bg-surface)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {players.map((member) => (
              (() => {
                const req = payerRequests.find((r) => r.tg_id === member.tg_id);
                const reqLabel =
                  req?.status === "pending"
                    ? "ЗАЯВКА"
                    : req?.status === "offered"
                      ? "ПРЕДЛОЖЕНО"
                      : req?.status === "accepted"
                        ? "ПРИНЯЛ"
                        : req?.status === "declined"
                          ? "ОТКАЗ"
                          : null;
                return (
              <button
                key={member.tg_id}
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await payerSelect(Number(matchId), member.tg_id);
                    setShowPayerModal(false);
                    load();
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
                className={`w-full flex items-center p-3 border-2 border-[var(--border-main)] rounded-2xl transition-all active:scale-95 ${
                  payerInfo?.payer_tg_id === member.tg_id
                    ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] shadow-brutal scale-[1.02]"
                    : "bg-[var(--bg-surface)] text-[var(--text-main)]"
                }`}
              >
                {member.avatar ? (
                  <img
                    src={resolveMediaUrl(member.avatar)}
                    className="w-10 h-10 rounded-lg border-2 border-[var(--border-main)] mr-3 object-cover"
                    alt=""
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-[var(--border-main)] mr-3 flex items-center justify-center font-black"
                    style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                  >
                    {getInitials(member.name)}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-black italic uppercase text-sm leading-none mb-1">{member.name}</div>
                  <div className="font-bold text-[8px] uppercase tracking-widest opacity-50">ELO ИГРОКА: {member.rating ?? "--"}</div>
                </div>
                {reqLabel ? (
                  <div className="mr-2 px-2 py-1 border-2 border-[var(--border-main)] rounded-lg text-[8px] font-black uppercase">
                    {reqLabel}
                  </div>
                ) : null}
                {payerInfo?.payer_tg_id === member.tg_id ? (
                  <div className="w-6 h-6 bg-[var(--text-contrast)] text-[var(--text-main)] rounded-full flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                ) : null}
              </button>
                );
              })()
            ))}
          </div>
          <div className="p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)]">
            <button
              onClick={() => setShowPayerModal(false)}
              className="w-full bg-[var(--bg-surface)] p-4 font-black uppercase text-xs border-2 border-[var(--border-main)] text-[var(--text-main)]"
            >
              ОТМЕНА
            </button>
          </div>
        </div>
      ) : null}

      {offerForMe && !hasPayer ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-sm">
          <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] p-6 rounded-[2.5rem] shadow-[12px_12px_0px_0px_var(--border-main)]">
            <h2 className="font-black italic uppercase text-2xl mb-6 leading-none text-[var(--text-main)]">ПРЕДЛОЖЕНИЕ ПЛАТЕЛЬЩИКА</h2>
            <div className="space-y-4 mb-8">
              <p className="font-bold text-xs text-[var(--text-main)] italic leading-snug">
                {t("Организатор предлагает вам оплатить матч. Согласны?")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await payerRespond(Number(matchId), true);
                    load();
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
                className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-4 font-black italic uppercase text-sm shadow-[6px_6px_0px_0px_var(--border-main)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                ПРИНЯТЬ
              </button>
              <button
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await payerRespond(Number(matchId), false);
                    load();
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
                className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-3 font-black uppercase text-[10px] active:scale-95 text-[var(--text-main)]"
              >
                ОТКЛОНИТЬ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-[var(--bg-surface)] border-4 border-[var(--border-main)] rounded-[2.5rem] shadow-[12px_12px_0px_0px_var(--border-main)] text-[var(--text-main)]">
          <DialogHeader>
            <DialogTitle className="font-black italic uppercase text-xl text-[var(--text-main)]">
              {t("Как присоединиться?")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {data.match.status !== "generating" ? (
              <button
                className="w-full h-11 rounded-xl font-black uppercase tracking-widest text-[10px]"
                style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                onClick={async () => {
                  await handleJoin();
                  setJoinOpen(false);
                }}
              >
                {t("Я игрок")}
              </button>
            ) : null}
            <button
              className="w-full h-11 rounded-xl border-2 font-black uppercase tracking-widest text-[10px]"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
              onClick={async () => {
                await handleSpectate();
                setJoinOpen(false);
              }}
            >
              {t("Я зритель")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permissionTarget} onOpenChange={(open) => (!open ? setPermissionTarget(null) : null)}>
        <DialogContent className="bg-[var(--bg-surface)] border-4 border-[var(--border-main)] rounded-[2.5rem] shadow-[12px_12px_0px_0px_var(--border-main)] text-[var(--text-main)]">
          <DialogHeader>
            <DialogTitle className="font-black italic uppercase text-xl text-[var(--text-main)]">
              {t("Дать доступ к событиям матча?")}
            </DialogTitle>
          </DialogHeader>
          {permissionTarget ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-main)]">
                {permissionTarget.can_edit
                  ? t("Забрать доступ к событиям у")
                  : t("Разрешить редактирование событий для")}{" "}
                <span className="font-black uppercase">{permissionTarget.name}</span>?
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  className="w-full h-11 rounded-xl font-black uppercase tracking-widest text-[10px]"
                  style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                  onClick={async () => {
                    if (!matchId || !permissionTarget) return;
                    try {
                      await updateMemberPermissions(
                        Number(matchId),
                        permissionTarget.tg_id,
                        !permissionTarget.can_edit
                      );
                      setPermissionTarget(null);
                      load();
                    } catch (err) {
                      setError(formatApiError(err));
                    }
                  }}
                >
                  {permissionTarget.can_edit ? t("Забрать доступ") : t("Дать доступ")}
                </button>
                <button
                  className="w-full h-11 rounded-xl border-2 font-black uppercase tracking-widest text-[10px]"
                  style={{
                    borderColor: "var(--border-main)",
                    background: "var(--bg-page)",
                    color: "var(--text-main)"
                  }}
                  onClick={() => setPermissionTarget(null)}
                >
                  {t("Отмена")}
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* payer offer dialog removed to match new/tem */}
      </div>
    </>
  );
}

