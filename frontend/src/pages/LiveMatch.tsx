import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";

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
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { GoalModal } from "../components/GoalModal";
import { StatusCard } from "../components/StatusCard";
import { useMatText } from "../lib/mode18";

export function LiveMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<"A" | "B">("A");
  const [editEvent, setEditEvent] = useState<MatchEvent | null>(null);
  const [flashTeam, setFlashTeam] = useState<"A" | "B" | null>(null);
  const [buttMode, setButtMode] = useState(false);
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

  const score = useMemo(() => {
    if (!data) return { A: 0, B: 0 };
    const active = [...data.segments].reverse().find((seg) => !seg.ended_at);
    if (!active) {
      return { A: 0, B: 0 };
    }
    return { A: active.score_a, B: active.score_b };
  }, [data]);
  const endedSegments = useMemo(
    () => data?.segments.filter((seg) => seg.ended_at) || [],
    [data]
  );

  const playerName = (tgId?: number | null) => {
    if (!tgId) return "-";
    const member = data?.members.find((m) => m.tg_id === tgId);
    return member?.name || "-";
  };

  const handleGoalSubmit = async ({ scorer_tg_id, assist_tg_id }: {
    scorer_tg_id: number;
    assist_tg_id?: number | null;
  }) => {
    if (!matchId) return;
    try {
      if (editEvent) {
        await patchEvent(Number(matchId), editEvent.id, { scorer_tg_id, assist_tg_id });
        setEditEvent(null);
      } else {
        await goal(Number(matchId), { team: selectedTeam, scorer_tg_id, assist_tg_id });
        setFlashTeam(selectedTeam);
        setTimeout(() => setFlashTeam(null), 500);
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
      setFlashTeam(selectedTeam === "A" ? "B" : "A");
      setTimeout(() => setFlashTeam(null), 500);
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
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const myMember = useMemo(
    () => data?.members.find((member) => member.tg_id === data?.me.tg_id) || null,
    [data]
  );
  const canEdit = !!(data && (data.me.is_admin || myMember?.role === "organizer" || myMember?.can_edit));
  const canScore = !!(
    data &&
    (data.me.is_admin ||
      myMember?.role === "player" ||
      myMember?.role === "organizer" ||
      myMember?.can_edit)
  );
  const isOrganizer = !!(data && (data.me.is_admin || myMember?.role === "organizer"));

  const teamMembers = (team: "A" | "B") => {
    if (!data) return [];
    const base = data.team_current?.current_teams || data.team_variants[0]?.teams;
    const ids = base ? base[team] : [];
    return ids
      .map((id) => data.members.find((member) => String(member.tg_id) === id))
      .filter(Boolean) as MatchMember[];
  };

  if (error) {
    return <StatusCard title={t("Ошибка")} message={error} />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>;
  }

  const teamNames = {
    A: data.team_current?.current_teams.name_a || t("Команда A"),
    B: data.team_current?.current_teams.name_b || t("Команда B")
  };

  const teamAPlayers = teamMembers("A").map((member) => ({
    tg_id: member.tg_id,
    name: member.name,
    avatar: member.avatar
  }));
  const teamBPlayers = teamMembers("B").map((member) => ({
    tg_id: member.tg_id,
    name: member.name,
    avatar: member.avatar
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold">{teamNames.A}</div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedTeam("A");
                  setGoalOpen(true);
                }}
                disabled={!canScore}
              >
                Гол
              </Button>
            </div>
            <div className="flex flex-col items-center">
              {buttMode ? (
                <div className="mb-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  {t("Игра на жопу")}
                </div>
              ) : null}
              <div className="relative flex items-center justify-center">
                <motion.div
                  key={`${score.A}-${score.B}`}
                  initial={{ scale: 0.96, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-5xl font-semibold"
                >
                  {score.A} : {score.B}
                </motion.div>
                {flashTeam ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 rounded-2xl ${
                      flashTeam === "A" ? "bg-primary/20" : "bg-secondary/20"
                    }`}
                  />
                ) : null}
                {flashTeam ? (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: -8, opacity: 1 }}
                    className={`absolute top-1/2 rounded-full px-3 py-1 text-xs font-semibold ${
                      flashTeam === "A"
                        ? "bg-primary/25 text-primary-foreground"
                        : "bg-secondary/25 text-secondary-foreground"
                    }`}
                  >
                    +1
                  </motion.div>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="text-sm font-semibold">{teamNames.B}</div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedTeam("B");
                  setGoalOpen(true);
                }}
                disabled={!canScore}
              >
                Гол
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!matchId) return;
                try {
                  await newSegment(Number(matchId), buttMode);
                  setButtMode(false);
                  load();
                } catch (err) {
                  setError(formatApiError(err));
                }
              }}
              disabled={!canEdit}
            >
              Сбросить счет
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!matchId) return;
                try {
                  await finishMatch(Number(matchId), buttMode);
                  navigate(`/matches/${matchId}/finished`, { replace: true });
                } catch (err) {
                  setError(formatApiError(err));
                }
              }}
              disabled={!canEdit}
            >
              Завершить матч
            </Button>
            <Button
              variant={buttMode ? "destructive" : "outline"}
              onClick={() => setButtMode((prev) => !prev)}
              disabled={!canEdit}
            >
              Отрезок на жопу
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {["A", "B"].map((team) => (
          <Card key={team}>
            <CardContent className="space-y-2">
            <div className="text-sm font-semibold">
              {t("Команда")} {team}
            </div>
              <div className="text-xs text-muted-foreground">
                {teamMembers(team as "A" | "B").map((member) => member.name).join(", ") || "-"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("События")}
        </div>
        <div className="space-y-3">
          {data.events.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("Событий пока нет")}</div>
          ) : (
            data.events.map((event) => (
              <Card key={event.id}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {event.event_type === "own_goal" ? t("Автогол") : t("Гол")} — {t("Команда")}{" "}
                      {event.team}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {playerName(event.scorer_tg_id)}
                      {event.assist_tg_id ? `, ${t("ассист")} ${playerName(event.assist_tg_id)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditEvent(event);
                        setGoalOpen(true);
                      }}
                      className="rounded-full p-2 hover:bg-muted"
                      disabled={!canEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event.id)}
                      className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                      disabled={!canEdit}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {endedSegments.length ? (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("Отрезки")}
          </div>
          <div className="space-y-2">
            {endedSegments.map((seg) => (
              <Card key={seg.id}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {t("Отрезок")} {seg.seg_no} {t("завершен")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {seg.score_a}:{seg.score_b} •{" "}
                      {seg.is_butt_game ? t("Игра на жопу") : t("Обычный")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!matchId) return;
                      try {
                        await deleteSegment(Number(matchId), seg.id);
                        load();
                      } catch (err) {
                        setError(formatApiError(err));
                      }
                    }}
                    disabled={!canEdit}
                  >
                    Удалить
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">{t("Зрители")}</div>
          <div className="space-y-2">
            {data.members.filter((m) => m.role === "spectator").length === 0 ? (
              <div className="text-xs text-muted-foreground">{t("Зрителей нет")}</div>
            ) : (
              data.members
                .filter((m) => m.role === "spectator")
                .map((member) => (
                  <div
                    key={member.tg_id}
                    className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>{member.name}</span>
                    <div className="flex items-center gap-2">
                      {member.can_edit ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          ✏️ {t("редактор")}
                        </span>
                      ) : null}
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!matchId) return;
                            try {
                              await updateMemberPermissions(
                                Number(matchId),
                                member.tg_id,
                                !member.can_edit
                              );
                              load();
                            } catch (err) {
                              setError(formatApiError(err));
                            }
                          }}
                        >
                          {member.can_edit ? "Убрать права" : "Дать права"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      <GoalModal
        open={goalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditEvent(null);
          }
          setGoalOpen(open);
        }}
        players={selectedTeam === "A" ? teamAPlayers : teamBPlayers}
        onSubmit={handleGoalSubmit}
        onOwnGoal={handleOwnGoal}
        initialScorer={editEvent?.scorer_tg_id ?? null}
        initialAssist={editEvent?.assist_tg_id ?? null}
      />

    </div>
  );
}



