import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  deleteEvent,
  deleteSegment,
  finishMatch,
  getMatch,
  goal,
  newSegment,
  ownGoal,
  patchEvent,
  updateMemberPermissions
} from "../lib/api";
import type { MatchDetail, MatchEvent, MatchMember } from "../lib/types";
import { formatApiError } from "../lib/errors";
import { GoalModal } from "../components/GoalModal";
import { StatusCard } from "../components/StatusCard";
import { useMatText } from "../lib/mode18";
import { resolveMediaUrl } from "../lib/media";

export function LiveMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<"A" | "B">("A");
  const [editEvent, setEditEvent] = useState<MatchEvent | null>(null);
  const [scorerId, setScorerId] = useState<number | null>(null);
  const [buttMode, setButtMode] = useState(false);
  const [spectatorsOpen, setSpectatorsOpen] = useState(false);
  const [actionEventId, setActionEventId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState<Record<number, number>>({});
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [segmentSwipeX, setSegmentSwipeX] = useState<Record<number, number>>({});
  const [segmentDraggingId, setSegmentDraggingId] = useState<number | null>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    base: number;
    moved: boolean;
  } | null>(null);
  const segmentDragRef = useRef<{
    id: number;
    startX: number;
    base: number;
    moved: boolean;
  } | null>(null);

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
          if (alive) setData(result);
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
    if (!data || !matchId) return;
    if (data.match.status === "finished") {
      navigate(`/matches/${matchId}/finished`, { replace: true });
    }
  }, [data, matchId, navigate]);

  useEffect(() => {
    if (data?.config.butt_game_allowed) return;
    setButtMode(false);
  }, [data?.config.butt_game_allowed]);

  const score = useMemo(() => {
    if (!data) return { A: 0, B: 0 };
    const active = [...data.segments].reverse().find((seg) => !seg.ended_at);
    if (!active) return { A: 0, B: 0 };
    return { A: active.score_a, B: active.score_b };
  }, [data]);
  const timeline = useMemo(() => {
    if (!data) return [];
    const segmentById = new Map<number, MatchMember>();
    const eventsBySegment = new Map<number, MatchEvent[]>();
    data.events.forEach((event) => {
      const list = eventsBySegment.get(event.segment_id) || [];
      list.push(event);
      eventsBySegment.set(event.segment_id, list);
    });
    const items: Array<
      | { kind: "segment"; id: number; seg_no: number; is_butt_game: boolean; score_a: number; score_b: number }
      | { kind: "event"; event: MatchEvent; scoreAtEvent: string }
    > = [];
    data.segments.forEach((segment) => {
      items.push({
        kind: "segment",
        id: segment.id,
        seg_no: segment.seg_no,
        is_butt_game: segment.is_butt_game,
        score_a: segment.score_a,
        score_b: segment.score_b
      });
      let a = 0;
      let b = 0;
      const events = eventsBySegment.get(segment.id) || [];
      events.forEach((event) => {
        if (event.event_type === "goal") {
          if (event.team === "A") a += 1;
          else b += 1;
        } else if (event.event_type === "own_goal") {
          if (event.team === "A") b += 1;
          else a += 1;
        }
        items.push({ kind: "event", event, scoreAtEvent: `${a}:${b}` });
      });
    });
    return items;
  }, [data]);

  const playerName = (tgId?: number | null) => {
    if (!tgId) return "-";
    const member = data?.members.find((m) => m.tg_id === tgId);
    return member?.name || "-";
  };
  const playerPath = (tgId: number) => (matchId ? `/matches/${matchId}/players/${tgId}` : "#");

  const handleGoalSubmit = async ({ scorer_tg_id, assist_tg_id }: { scorer_tg_id: number; assist_tg_id?: number | null }) => {
    if (!matchId) return;
    try {
      if (editEvent) {
        await patchEvent(Number(matchId), editEvent.id, { scorer_tg_id, assist_tg_id });
        setEditEvent(null);
      } else {
        await goal(Number(matchId), { team: selectedTeam, scorer_tg_id, assist_tg_id });
      }
      setGoalOpen(false);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleOwnGoal = async () => {
    if (!matchId) return;
    try {
      await ownGoal(Number(matchId), selectedTeam);
      setGoalOpen(false);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleDelete = async (eventId: number) => {
    if (!matchId) return;
    try {
      await deleteEvent(Number(matchId), eventId);
      setActionEventId(null);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };
  const handleDeleteSegment = async (segmentId: number) => {
    if (!matchId) return;
    try {
      await deleteSegment(Number(matchId), segmentId);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const myMember = useMemo(
    () => data?.members.find((member) => member.tg_id === data?.me.tg_id) || null,
    [data]
  );
  const canScore = !!(
    data &&
    (data.me.is_admin ||
      myMember?.role === "player" ||
      myMember?.role === "organizer" ||
      myMember?.role === "spectator" ||
      myMember?.can_edit)
  );
  const canManageMatch = !!(
    data &&
    (data.me.is_admin || myMember?.role === "organizer" || myMember?.can_edit)
  );
  const buttGameAllowed = !!data?.config.butt_game_allowed;

  const teamMembers = (team: "A" | "B") => {
    if (!data) return [];
    const base = data.team_current?.current_teams || data.team_variants[0]?.teams;
    const ids = base ? base[team] : [];
    return ids
      .map((id) => data.members.find((member) => String(member.tg_id) === id))
      .filter(Boolean) as MatchMember[];
  };

  const errorToast = error ? <StatusCard title={t("Ошибка")} message={error} onClose={() => setError(null)} /> : null;

  const [confirmAction, setConfirmAction] = useState<
    | null
    | { type: "finish" }
    | { type: "new_segment" }
    | { type: "delete_segment"; segmentId: number }
  >(null);

  if (!data) {
    return (
      <>
        {errorToast}
        <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>
      </>
    );
  }

  const teamNames = {
    A: data.team_current?.current_teams.name_a || t("Команда A"),
    B: data.team_current?.current_teams.name_b || t("Команда B")
  };

  const teamAList = teamMembers("A");
  const teamBList = teamMembers("B");
  const teamAPlayers = teamAList.map((member) => ({
    tg_id: member.tg_id,
    name: member.name,
    avatar: member.avatar ? resolveMediaUrl(member.avatar) : null
  }));
  const teamBPlayers = teamBList.map((member) => ({
    tg_id: member.tg_id,
    name: member.name,
    avatar: member.avatar ? resolveMediaUrl(member.avatar) : null
  }));
  const spectators = data.members.filter((m) => m.role === "spectator");

  return (
    <>
      {errorToast}
      <div className="flex flex-col h-full bg-[var(--bg-page)]">
      <div className="flex-none px-3 pt-3 space-y-3">
        <div
          className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-5 rounded-[2rem] border-2 border-[var(--border-main)]"
          style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="text-center min-w-0 pr-1">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-60">TEAM A</div>
              <h2 className="text-lg font-black italic tracking-tighter leading-tight uppercase truncate">
                {teamNames.A}
              </h2>
            </div>
            <div className="px-2">
              <div className="bg-[var(--bg-surface)] text-[var(--text-main)] h-14 w-28 flex items-center justify-center rounded-2xl border-2 border-[var(--bg-surface)] overflow-hidden">
                <div className="w-10 text-center text-4xl font-black tracking-tighter tabular-nums leading-none">{score.A}</div>
                <div className="w-4 text-center text-2xl font-black opacity-20 mb-1">:</div>
                <div className="w-10 text-center text-4xl font-black tracking-tighter tabular-nums leading-none">{score.B}</div>
              </div>
            </div>
            <div className="text-center min-w-0 pl-1">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-60">TEAM B</div>
              <h2 className="text-lg font-black italic tracking-tighter leading-tight uppercase truncate">
                {teamNames.B}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSpectatorsOpen(true)}
            className={`${buttGameAllowed ? "w-12" : "flex-1"} py-1.5 rounded-lg border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-[var(--text-main)] flex items-center justify-center active:scale-95 transition-transform`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {buttGameAllowed ? (
            <button
              onClick={() => setButtMode((prev) => !prev)}
              className="flex-1 py-1.5 rounded-lg border-2 border-[var(--border-main)] font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                backgroundColor: buttMode ? "var(--bg-contrast)" : "var(--bg-surface)",
                color: buttMode ? "var(--text-contrast)" : "var(--text-main)"
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${buttMode ? "bg-green-400" : "bg-neutral-300"}`} />
              MODE: {buttMode ? "НА ЖОПУ ON" : "НА ЖОПУ OFF"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">
            SQUAD LINEUPS
          </span>
          <div className="h-[1px] flex-1 mx-4 bg-[var(--border-main)] opacity-20"></div>
          <span className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">
            {teamAList.length} ON {teamBList.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {teamAList.map((player) => (
              <div
                key={player.tg_id}
                className="relative h-14 rounded-xl border-2 border-[var(--border-main)] flex items-center p-1 overflow-hidden"
                style={{ backgroundColor: "var(--bg-contrast)", color: "var(--text-contrast)" }}
              >
                <Link to={playerPath(player.tg_id)} className="flex items-center min-w-0 flex-1">
                  {player.avatar ? (
                    <img src={resolveMediaUrl(player.avatar)} alt={player.name} className="w-10 h-10 rounded-lg object-cover grayscale" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface)] text-[var(--text-main)] flex items-center justify-center text-[10px] font-black">
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-2 flex-1 min-w-0">
                    <div className="text-[11px] font-black italic leading-none truncate">{player.name}</div>
                  </div>
                </Link>
                <div className="flex flex-col justify-center ml-1 pr-1">
                  <button
                    onClick={() => {
                      if (!canScore) return;
                      setSelectedTeam("A");
                      setScorerId(player.tg_id);
                      setEditEvent(null);
                      setGoalOpen(true);
                    }}
                    className="h-9 px-3 rounded-md border-[1.5px] border-[var(--border-main)] text-[9px] font-black italic uppercase active:scale-95"
                    style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-main)" }}
                  >
                    GOAL
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {teamBList.map((player) => (
              <div
                key={player.tg_id}
                className="relative h-14 rounded-xl border-2 border-[var(--border-main)] flex items-center p-1 overflow-hidden"
                style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-main)" }}
              >
                <Link to={playerPath(player.tg_id)} className="flex items-center min-w-0 flex-1">
                  {player.avatar ? (
                    <img src={resolveMediaUrl(player.avatar)} alt={player.name} className="w-10 h-10 rounded-lg object-cover grayscale" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center text-[10px] font-black">
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-2 flex-1 min-w-0">
                    <div className="text-[11px] font-black italic leading-none truncate">{player.name}</div>
                  </div>
                </Link>
                <div className="flex flex-col justify-center ml-1 pr-1">
                  <button
                    onClick={() => {
                      if (!canScore) return;
                      setSelectedTeam("B");
                      setScorerId(player.tg_id);
                      setEditEvent(null);
                      setGoalOpen(true);
                    }}
                    className="h-9 px-3 rounded-md border-[1.5px] border-[var(--border-main)] text-[9px] font-black italic uppercase active:scale-95"
                    style={{ backgroundColor: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                  >
                    GOAL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-black italic tracking-tighter uppercase text-[var(--text-main)]">TIMELINE</h3>
            <div className="h-[2px] bg-[var(--border-main)] flex-1"></div>
            <div className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">GAME LOG</div>
          </div>
          <div className="space-y-3 pb-8">
            {timeline.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-main)] rounded-[2rem] opacity-40">
                <span className="font-black text-[10px] uppercase tracking-widest text-[var(--text-main)]">
                  Awaiting game events
                </span>
              </div>
            ) : (
              timeline.map((item, idx) => {
                if (item.kind === "segment") {
                  const segSwipe = segmentSwipeX[item.id] ?? 0;
                  const segDragging = segmentDraggingId === item.id;
                  return (
                    <div key={`seg-${item.seg_no}-${idx}`} className="relative h-12 overflow-hidden">
                      {canManageMatch ? (
                        <div className="absolute right-0 top-0 h-12 w-16 flex items-center justify-center z-0">
                          <button
                            onClick={() => setConfirmAction({ type: "delete_segment", segmentId: item.id })}
                            className="h-8 w-8 rounded-lg border-2 border-[var(--border-main)] flex items-center justify-center bg-[#ef4444] text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                      <div
                        onPointerDown={(e) => {
                          if (!canManageMatch) return;
                          if (!e.isPrimary) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          segmentDragRef.current = {
                            id: item.id,
                            startX: e.clientX,
                            base: segSwipe,
                            moved: false
                          };
                          setSegmentDraggingId(item.id);
                        }}
                        onPointerMove={(e) => {
                          if (!segmentDragRef.current || segmentDragRef.current.id !== item.id) return;
                          const dx = e.clientX - segmentDragRef.current.startX;
                          if (Math.abs(dx) > 2) segmentDragRef.current.moved = true;
                          let next = segmentDragRef.current.base + dx;
                          if (next > 0) next = 0;
                          if (next < -64) next = -64;
                          setSegmentSwipeX((prev) => ({ ...prev, [item.id]: next }));
                        }}
                        onPointerUp={(e) => {
                          if (!segmentDragRef.current || segmentDragRef.current.id !== item.id) return;
                          const moved = segmentDragRef.current.moved;
                          const current = segmentSwipeX[item.id] ?? 0;
                          let final = current;
                          if (!moved) {
                            final = current < -32 ? 0 : -64;
                          } else {
                            final = current < -32 ? -64 : 0;
                          }
                          setSegmentSwipeX((prev) => ({ ...prev, [item.id]: final }));
                          segmentDragRef.current = null;
                          setSegmentDraggingId(null);
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                        onPointerCancel={() => {
                          if (!segmentDragRef.current || segmentDragRef.current.id !== item.id) return;
                          setSegmentSwipeX((prev) => ({ ...prev, [item.id]: segmentDragRef.current?.base ?? 0 }));
                          segmentDragRef.current = null;
                          setSegmentDraggingId(null);
                        }}
                        className="h-12 rounded-[1.2rem] border-2 border-dashed border-[var(--border-main)] flex items-center px-4 uppercase text-[10px] font-black tracking-widest text-[var(--text-main)] relative z-10"
                        style={{
                          backgroundColor: "var(--bg-page)",
                          transform: `translateX(${segSwipe}px)`,
                          transition: segDragging ? "none" : "transform 200ms ease",
                          touchAction: "pan-y"
                        }}
                      >
                        <span className="opacity-70">
                          SEGMENT {item.seg_no} • {item.score_a}:{item.score_b} {item.is_butt_game ? "• НА ЖОПУ" : ""}
                        </span>
                      </div>
                    </div>
                  );
                }
                const event = item.event;
                const isOG = event.event_type === "own_goal";
                const isTeamA = event.team === "A";
                const isActive = actionEventId === event.id;
                const currentSwipe = swipeX[event.id] ?? (isActive ? -96 : 0);
                const isDragging = draggingId === event.id;
                return (
                  <div key={event.id} className="relative h-16 overflow-hidden">
                    <div className="absolute right-0 top-0 h-16 flex items-center gap-2 pr-2">
                      <button
                        onClick={() => {
                          if (!canScore) return;
                          setSelectedTeam(event.team as "A" | "B");
                          setEditEvent(event);
                          setGoalOpen(true);
                        }}
                        className="h-10 w-10 rounded-lg border-2 border-[var(--border-main)] flex items-center justify-center bg-[var(--bg-surface)]"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="h-10 w-10 rounded-lg border-2 border-[var(--border-main)] flex items-center justify-center bg-[#ef4444] text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div
                      onPointerDown={(e) => {
                        if (!e.isPrimary) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragRef.current = {
                          id: event.id,
                          startX: e.clientX,
                          base: currentSwipe,
                          moved: false
                        };
                        setDraggingId(event.id);
                      }}
                      onPointerMove={(e) => {
                        if (!dragRef.current || dragRef.current.id !== event.id) return;
                        const dx = e.clientX - dragRef.current.startX;
                        if (Math.abs(dx) > 2) dragRef.current.moved = true;
                        let next = dragRef.current.base + dx;
                        if (next > 0) next = 0;
                        if (next < -96) next = -96;
                        setSwipeX((prev) => ({ ...prev, [event.id]: next }));
                      }}
                      onPointerUp={(e) => {
                        if (!dragRef.current || dragRef.current.id !== event.id) return;
                        const moved = dragRef.current.moved;
                        const current = swipeX[event.id] ?? 0;
                        let final = current;
                        if (!moved) {
                          final = current < -48 ? 0 : -96;
                        } else {
                          final = current < -48 ? -96 : 0;
                        }
                        setSwipeX((prev) => ({ ...prev, [event.id]: final }));
                        setActionEventId(final < 0 ? event.id : null);
                        dragRef.current = null;
                        setDraggingId(null);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }}
                      onPointerCancel={() => {
                        if (!dragRef.current || dragRef.current.id !== event.id) return;
                        setSwipeX((prev) => ({ ...prev, [event.id]: dragRef.current?.base ?? 0 }));
                        dragRef.current = null;
                        setDraggingId(null);
                      }}
                      className="relative h-16 rounded-[1.2rem] border-2 border-[var(--border-main)] flex items-center px-4 overflow-hidden"
                      style={{
                        transform: `translateX(${currentSwipe}px)`,
                        transition: isDragging ? "none" : "transform 200ms ease",
                        touchAction: "pan-y",
                        backgroundColor: isOG ? "#D1383D" : isTeamA ? "var(--bg-contrast)" : "var(--bg-surface)",
                        color: isOG ? "white" : isTeamA ? "var(--text-contrast)" : "var(--text-main)"
                      }}
                    >
                      <div className="w-10 text-xl font-black tracking-tighter">{item.scoreAtEvent}</div>
                      <div className="mx-3 h-8 w-[1px] bg-current opacity-30"></div>
                      <div className="flex-1">
                        <div className="text-sm font-black italic leading-none uppercase tracking-tighter">
                          {event.scorer_tg_id ? (
                            <Link to={playerPath(event.scorer_tg_id)} className="underline-offset-2 hover:underline">
                              {playerName(event.scorer_tg_id)}
                            </Link>
                          ) : (
                            playerName(event.scorer_tg_id)
                          )}
                        </div>
                        {isOG ? (
                          <div className="text-[9px] font-bold opacity-80 uppercase mt-0.5">OWN GOAL ERROR</div>
                        ) : event.assist_tg_id ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] font-black border-[1px] border-current px-1 rounded opacity-60">ASSIST</span>
                            <span className="text-[9px] font-bold opacity-80 uppercase">
                              {event.assist_tg_id ? (
                                <Link to={playerPath(event.assist_tg_id)} className="underline-offset-2 hover:underline">
                                  {playerName(event.assist_tg_id)}
                                </Link>
                              ) : (
                                playerName(event.assist_tg_id)
                              )}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-2xl">{isOG ? "💀" : "⚽"}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {canManageMatch ? (
        <div className="flex-none p-4 bg-[var(--bg-surface)] border-t-2 border-[var(--border-main)] z-20">
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAction({ type: "finish" })}
              className="flex-[3] bg-[var(--bg-contrast)] text-[var(--text-contrast)] h-16 rounded-2xl text-xl font-black italic tracking-tighter uppercase active:scale-95 transition-transform flex items-center justify-center border-2 border-[var(--border-main)]"
            >
              FINISH GAME
            </button>
            <button
              onClick={() => setConfirmAction({ type: "new_segment" })}
              className="flex-1 bg-[var(--bg-surface)] text-[var(--text-main)] h-16 rounded-2xl text-[10px] font-black uppercase border-2 border-[var(--border-main)] active:scale-95 transition-transform flex items-center justify-center tracking-widest leading-none text-center"
            >
              RESET
              <br />
              STATS
            </button>
          </div>
        </div>
      ) : null}

      <GoalModal
        open={goalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditEvent(null);
            setScorerId(null);
          }
          setGoalOpen(open);
        }}
        players={selectedTeam === "A" ? teamAPlayers : teamBPlayers}
        onSubmit={handleGoalSubmit}
        onOwnGoal={handleOwnGoal}
        initialScorer={editEvent?.scorer_tg_id ?? scorerId ?? null}
        initialAssist={editEvent?.assist_tg_id ?? null}
      />

      {spectatorsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-[320px] bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black italic uppercase text-lg text-[var(--text-main)]">Spectators</h3>
              <button
                onClick={() => setSpectatorsOpen(false)}
                className="w-8 h-8 border-2 border-[var(--border-main)] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
            {spectators.length ? (
                spectators.map((s) => (
                  <div
                    key={s.tg_id}
                    className="flex items-center justify-between border-2 border-[var(--border-main)] rounded-xl px-3 py-2"
                  >
                    <Link to={playerPath(s.tg_id)} className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] hover:underline underline-offset-2">
                      {s.name}
                    </Link>
                    {canManageMatch ? (
                      <button
                        onClick={async () => {
                          if (!matchId) return;
                          try {
                            await updateMemberPermissions(Number(matchId), s.tg_id, !s.can_edit);
                            load();
                          } catch (err) {
                            setError(formatApiError(err));
                          }
                        }}
                        className="text-[8px] font-black uppercase tracking-widest border-2 border-[var(--border-main)] px-2 py-1 rounded-lg"
                        style={{
                          backgroundColor: s.can_edit ? "var(--bg-contrast)" : "var(--bg-page)",
                          color: s.can_edit ? "var(--text-contrast)" : "var(--text-main)"
                        }}
                      >
                        {s.can_edit ? "REVOKE" : "ALLOW"}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] opacity-50">
                  No spectators
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {confirmAction ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-[320px] bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6">
            <h3 className="font-black italic uppercase text-lg text-[var(--text-main)] mb-4">
              {confirmAction.type === "finish"
                ? "ЗАВЕРШИТЬ МАТЧ?"
                : confirmAction.type === "new_segment"
                  ? "СОЗДАТЬ НОВЫЙ СЕГМЕНТ?"
                  : "УДАЛИТЬ СЕГМЕНТ?"}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    if (confirmAction.type === "finish") {
                      await finishMatch(Number(matchId), buttGameAllowed && buttMode);
                    } else if (confirmAction.type === "new_segment") {
                      await newSegment(Number(matchId), buttGameAllowed && buttMode);
                      load();
                    } else if (confirmAction.type === "delete_segment") {
                      await deleteSegment(Number(matchId), confirmAction.segmentId);
                      load();
                    }
                    setConfirmAction(null);
                  } catch (err) {
                    setConfirmAction(null);
                    setError(formatApiError(err));
                  }
                }}
                className="w-full h-11 rounded-xl font-black uppercase tracking-widest text-[10px]"
                style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
              >
                ПОДТВЕРДИТЬ
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="w-full h-11 rounded-xl border-2 font-black uppercase tracking-widest text-[10px]"
                style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
              >
                ОТМЕНА
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}



