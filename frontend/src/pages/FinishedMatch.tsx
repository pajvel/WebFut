import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { confirmPayment, getFeedback, getMatch, markPaid, payerDetails, submitFeedback } from "../lib/api";
import type { MatchDetail, MatchMember } from "../lib/types";
import { formatApiError } from "../lib/errors";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { StatusCard } from "../components/StatusCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { resolveMediaUrl } from "../lib/media";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useMatText } from "../lib/mode18";

export function FinishedMatch() {
  const { matchId } = useParams();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [payerForm, setPayerForm] = useState({ fio: "", phone: "", bank: "" });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string | string[]>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved">("idle");

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
    if (!matchId) return;
    getFeedback(Number(matchId))
      .then((result) => {
        if (!result?.answers_json) return;
        const answers = result.answers_json as Record<string, unknown>;
        const next: Record<string, string | string[]> = {};
        if (result.mvp_vote_tg_id) {
          next.best = String(result.mvp_vote_tg_id);
        } else if (answers.best) {
          next.best = String(answers.best);
        }
        if (answers.worst) {
          next.worst = String(answers.worst);
        }
        const comparisons = (answers.comparisons || {}) as Record<string, unknown>;
        if (comparisons.cmp_own) next.cmp_own = String(comparisons.cmp_own);
        if (comparisons.cmp_opp) next.cmp_opp = String(comparisons.cmp_opp);
        if (comparisons.cmp_cross) next.cmp_cross = String(comparisons.cmp_cross);
        const expandedPairs = (answers.expanded_pairs || {}) as Record<string, unknown>;
        if (expandedPairs.syn_team_a) next.syn_team_a = String(expandedPairs.syn_team_a);
        if (expandedPairs.syn_team_b) next.syn_team_b = String(expandedPairs.syn_team_b);
        if (expandedPairs.syn_opp_a) next.syn_opp_a = String(expandedPairs.syn_opp_a);
        if (expandedPairs.syn_opp_b) next.syn_opp_b = String(expandedPairs.syn_opp_b);
        if (expandedPairs.dom_my) next.dom_my = String(expandedPairs.dom_my);
        if (expandedPairs.dom_opp_target) next.dom_opp_target = String(expandedPairs.dom_opp_target);
        if (expandedPairs.dom_opp) next.dom_opp = String(expandedPairs.dom_opp);
        if (expandedPairs.dom_my_target) next.dom_my_target = String(expandedPairs.dom_my_target);
        const roleVote = (answers.role_vote || {}) as Record<string, unknown>;
        if (roleVote.player_id) next.role_player = String(roleVote.player_id);
        if (roleVote.role) next.role_type = String(roleVote.role);
        setFeedback(next);
        setFeedbackStatus("saved");
      })
      .catch((err) => setError(formatApiError(err)));
  }, [matchId]);

  useEffect(() => {
    if (!data?.payments?.payer) return;
    if (data.payments.payer.payer_tg_id !== data.me.tg_id) return;
    setPayerForm({
      fio: data.payments.payer.payer_fio || "",
      phone: data.payments.payer.payer_phone || "",
      bank: data.payments.payer.payer_bank || ""
    });
  }, [data]);

  useEffect(() => {
    const id = window.setInterval(() => setTimerTick((prev) => prev + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const score = useMemo(() => {
    if (!data) return { A: 0, B: 0 };
    const lastSegment = [...data.segments].reverse().find((seg) => seg.ended_at) || data.segments[data.segments.length - 1];
    if (!lastSegment) return { A: 0, B: 0 };
    return { A: lastSegment.score_a, B: lastSegment.score_b };
  }, [data]);
  const segmentScores = useMemo(() => {
    if (!data) return [];
    return data.segments
      .filter((seg) => seg.ended_at)
      .map((seg) => ({ id: seg.id, label: `Отрезок ${seg.seg_no}`, score: `${seg.score_a}:${seg.score_b}` }));
  }, [data]);

  const isPlayer = useMemo(() => {
    if (!data) return false;
    const me = data.members.find((m) => m.tg_id === data.me.tg_id);
    return me?.role === "player" || me?.role === "organizer";
  }, [data]);
  const myMember = useMemo(
    () => data?.members.find((m) => m.tg_id === data?.me.tg_id) || null,
    [data]
  );
  const payerInfo = data?.payments?.payer || null;
  const isPayer = !!(payerInfo && payerInfo.payer_tg_id === data?.me.tg_id);
  const paymentStatuses = data?.payments?.statuses || [];
  const myPaymentStatus = paymentStatuses.find((item) => item.tg_id === data?.me.tg_id)?.status || "unpaid";
  const playersOnly = useMemo(
    () => data?.members.filter((member) => member.role !== "spectator") || [],
    [data]
  );
  const statusLabel = (status: string) => {
    if (status === "reported_paid") return t("Ждет подтверждения");
    if (status === "confirmed") return t("Подтверждено");
    if (status === "rejected") return t("Отклонено");
    return t("Не оплатил");
  };

  const mvpCountdown = useMemo(() => {
    if (!data?.match.finished_at) return null;
    const end = new Date(data.match.finished_at).getTime() + 72 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = Math.max(0, end - now);
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
  }, [data, timerTick]);

  const teamNames = useMemo(() => {
    const current = data?.team_current?.current_teams as { name_a?: string; name_b?: string } | undefined;
    return {
      A: current?.name_a || t("Команда A"),
      B: current?.name_b || t("Команда B")
    };
  }, [data, t]);

  const teamMembers = useMemo(() => {
    if (!data) return { A: [], B: [] };
    const base = data.team_current?.current_teams || data.team_variants[0]?.teams;
    if (!base) return { A: [], B: [] };
    const mapMember = (id: string) =>
      data.members.find((member) => String(member.tg_id) === id) as MatchMember | undefined;
    return {
      A: base.A.map(mapMember).filter(Boolean) as MatchMember[],
      B: base.B.map(mapMember).filter(Boolean) as MatchMember[]
    };
  }, [data]);
  const allPlayers = useMemo(
    () => [...teamMembers.A, ...teamMembers.B],
    [teamMembers]
  );
  const myTeamKey = useMemo(() => {
    if (!myMember) return "A";
    const isA = teamMembers.A.some((member) => member.tg_id === myMember.tg_id);
    return isA ? "A" : "B";
  }, [myMember, teamMembers]);
  const myTeam = myTeamKey === "A" ? teamMembers.A : teamMembers.B;
  const oppTeam = myTeamKey === "A" ? teamMembers.B : teamMembers.A;
  const selfId = myMember?.tg_id ?? null;
  const selectablePlayers = useMemo(
    () => allPlayers.filter((player) => player.tg_id !== selfId),
    [allPlayers, selfId]
  );
  const myTeamSelectable = useMemo(
    () => myTeam.filter((player) => player.tg_id !== selfId),
    [myTeam, selfId]
  );
  const allPlayersSelectable = selectablePlayers;

  const eventsBySegment = useMemo(() => {
    if (!data) return [];
    return data.segments.map((seg) => ({
      ...seg,
      events: data.events.filter((ev) => ev.segment_id === seg.id)
    }));
  }, [data]);

  const seedBase = Number(matchId || 0) || 1;
  const pickIndex = (length: number, seed: number) => {
    if (!length) return 0;
    return Math.abs((seed * 9301 + 49297) % 233280) % length;
  };
  const pickPair = (pool: MatchMember[], seed: number) => {
    if (pool.length === 0) return [null, null] as const;
    if (pool.length === 1) return [pool[0], pool[0]] as const;
    const first = pool[pickIndex(pool.length, seed)];
    let second = pool[pickIndex(pool.length, seed + 11)];
    if (second?.tg_id === first?.tg_id) {
      second = pool[pickIndex(pool.length, seed + 23)];
    }
    return [first, second] as const;
  };
  const roleQuestion = useMemo(() => {
    const savedRole = typeof feedback.role_type === "string" ? feedback.role_type : null;
    if (savedRole === "attacker") {
      return { role: "attacker", text: t("Кто лучше всех играл в атаке?") };
    }
    if (savedRole === "defender") {
      return { role: "defender", text: t("Кто лучше всех играл в защите?") };
    }
    const seed = seedBase * 1000003 + Number(data?.me?.tg_id || 0);
    const pick = Math.abs((seed * 9301 + 49297) % 233280) % 2;
    return pick === 0
      ? { role: "attacker", text: t("Кто лучше всех играл в атаке?") }
      : { role: "defender", text: t("Кто лучше всех играл в защите?") };
  }, [data?.me?.tg_id, feedback.role_type, seedBase, t]);
  const feedbackPayload = useMemo(() => {
    const toNumber = (value: string | string[] | undefined) => {
      if (!value) return null;
      const raw = Array.isArray(value) ? value[0] : value;
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? null : parsed;
    };
    const rolePlayer = toNumber(feedback.role_player);
    const roleType = roleQuestion.role;
    const pairToIds = (pair: readonly (MatchMember | null)[]) =>
      pair[0] && pair[1] ? [pair[0].tg_id, pair[1].tg_id] : [];
    const comparisonPairs = {
      cmp_own: pairToIds(pickPair(myTeamSelectable, seedBase + 0 * 13)),
      cmp_opp: pairToIds(pickPair(oppTeam, seedBase + 1 * 13)),
      cmp_cross: pairToIds(pickPair(allPlayersSelectable, seedBase + 2 * 13))
    };
    return {
      mvp_vote_tg_id: toNumber(feedback.best),
      answers_json: {
        best: toNumber(feedback.best),
        worst: toNumber(feedback.worst),
        comparisons: {
          cmp_own: toNumber(feedback.cmp_own),
          cmp_opp: toNumber(feedback.cmp_opp),
          cmp_cross: toNumber(feedback.cmp_cross)
        },
        comparison_pairs: comparisonPairs,
        expanded_pairs: {
          syn_team_a: toNumber(feedback.syn_team_a),
          syn_team_b: toNumber(feedback.syn_team_b),
          syn_opp_a: toNumber(feedback.syn_opp_a),
          syn_opp_b: toNumber(feedback.syn_opp_b),
          dom_my: toNumber(feedback.dom_my),
          dom_opp_target: toNumber(feedback.dom_opp_target),
          dom_opp: toNumber(feedback.dom_opp),
          dom_my_target: toNumber(feedback.dom_my_target)
        },
        role_vote: rolePlayer && roleType ? { player_id: rolePlayer, role: roleType } : null
      }
    };
  }, [
    feedback,
    myTeamSelectable,
    oppTeam,
    allPlayersSelectable,
    seedBase,
    roleQuestion.role
  ]);

  if (error) {
    return <StatusCard title={t("Ошибка")} message={error} />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>;
  }

  const summary = (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-xs font-semibold text-muted-foreground">
          <div className="text-left">{teamNames.A}</div>
          <div className="text-center">{t("Счет")}</div>
          <div className="text-right">{teamNames.B}</div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-2">
            {teamMembers.A.map((member) => (
              <Link
                key={member.tg_id}
                to={`/matches/${matchId}/players/${member.tg_id}`}
                className="flex items-center gap-2"
              >
                <Avatar className="h-8 w-8 border border-border">
                  {member.avatar ? <AvatarImage src={resolveMediaUrl(member.avatar)} /> : null}
                  <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="truncate text-sm font-medium">{member.name}</div>
              </Link>
            ))}
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-2 text-4xl font-semibold shadow-soft">
              {score.A} : {score.B}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{t("Итоговый счет")}</div>
            {segmentScores.length > 1 ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {segmentScores.map((seg) => seg.score).join(" · ")}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            {teamMembers.B.map((member) => (
              <Link
                key={member.tg_id}
                to={`/matches/${matchId}/players/${member.tg_id}`}
                className="flex items-center gap-2 justify-end"
              >
                <div className="truncate text-sm font-medium text-right">{member.name}</div>
                <Avatar className="h-8 w-8 border border-border">
                  {member.avatar ? <AvatarImage src={resolveMediaUrl(member.avatar)} /> : null}
                  <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const simpleScore = (
    <Card>
      <CardContent className="flex flex-col items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("Итоговый счет")}
        </div>
        <div className="text-4xl font-semibold">
          {score.A} : {score.B}
        </div>
      </CardContent>
    </Card>
  );

  const eventsTimeline = (
    <div className="space-y-3">
      {eventsBySegment.map((seg) => (
        <Card key={seg.id}>
          <CardContent className="space-y-2">
            <div className="text-sm font-semibold">
              {t("Отрезок")} {seg.seg_no}
            </div>
            <div className="text-xs text-muted-foreground">
              {seg.score_a}:{seg.score_b} | {seg.is_butt_game ? t("Игра на жопу") : t("Обычный")}
            </div>
            <div className="space-y-1 text-sm">
              {seg.events.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t("Событий нет")}</div>
              ) : (
                seg.events.map((ev) => (
                  <div key={ev.id}>
                    {ev.event_type === "own_goal" ? t("Автогол") : t("Гол")} — {t("Команда")} {ev.team}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {isPlayer ? (
        <Tabs defaultValue="summary">
          <TabsList className="w-full justify-between">
            <TabsTrigger value="summary">{t("Итог")}</TabsTrigger>
            <TabsTrigger value="events">{t("События")}</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            {summary}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-2">
                  <div className="text-sm font-semibold">MVP</div>
                  <div className="text-xs text-muted-foreground">
                    {t("Голосование завершится через")} {mvpCountdown?.hours ?? 0}ч{" "}
                    {mvpCountdown?.minutes ?? 0}м
                  </div>
                  <div className="text-sm">
                    {t("Текущий лидер")}:{" "}
                    {data.mvp?.top_tg_id
                      ? data.members.find((m) => m.tg_id === data.mvp?.top_tg_id)?.name || data.mvp?.top_tg_id
                      : t("нет")}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2">
                  <div className="text-sm font-semibold">{t("Плательщик")}</div>
                  {payerInfo ? (
                    <div className="space-y-2 text-sm">
                      {isPayer ? (
                        <div className="space-y-2 pt-2">
                          <div className="text-xs text-muted-foreground">
                            {t("Заполните данные для оплаты")}
                          </div>
                          <div className="space-y-2">
                            <Input
                              placeholder={t("ФИО")}
                              value={payerForm.fio}
                              onChange={(event) =>
                                setPayerForm((prev) => ({ ...prev, fio: event.target.value }))
                              }
                            />
                            <Input
                              placeholder={t("Телефон")}
                              value={payerForm.phone}
                              onChange={(event) =>
                                setPayerForm((prev) => ({ ...prev, phone: event.target.value }))
                              }
                            />
                            <Input
                              placeholder={t("Банк")}
                              value={payerForm.bank}
                              onChange={(event) =>
                                setPayerForm((prev) => ({ ...prev, bank: event.target.value }))
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (!matchId) return;
                                try {
                                  await payerDetails(Number(matchId), {
                                    payer_fio: payerForm.fio,
                                    payer_phone: payerForm.phone,
                                    payer_bank: payerForm.bank
                                  });
                                  const refreshed = await getMatch(Number(matchId));
                                  setData(refreshed);
                                } catch (err) {
                                  setError(formatApiError(err));
                                }
                              }}
                            >
                              {t("Сохранить")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
                              {t("Отчет")}
                            </Button>
                          </div>
                        </div>
                      ) : isPlayer ? (
                        <div className="pt-2">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">{t("ФИО")}</div>
                            <div>{payerInfo.payer_fio || t("Без имени")}</div>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-muted-foreground">{t("Телефон")}</div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{payerInfo.payer_phone || t("Нет телефона")}</span>
                              {payerInfo.payer_phone ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigator.clipboard.writeText(payerInfo.payer_phone || "")
                                  }
                                >
                                  {t("Копировать")}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-muted-foreground">{t("Банк")}</div>
                            <div>{payerInfo.payer_bank || t("Нет банка")}</div>
                          </div>
                          {myPaymentStatus === "confirmed" ? null : (
                            <Button
                              size="sm"
                              className="mt-3"
                              onClick={async () => {
                                if (!matchId) return;
                                try {
                                  await markPaid(Number(matchId));
                                  const refreshed = await getMatch(Number(matchId));
                                  setData(refreshed);
                                } catch (err) {
                                  setError(formatApiError(err));
                                }
                              }}
                              disabled={myPaymentStatus === "reported_paid"}
                            >
                              {myPaymentStatus === "reported_paid"
                                ? t("Ждет подтверждения")
                                : t("Скинул")}
                            </Button>
                          )}
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t("Статус")}: {statusLabel(myPaymentStatus)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{t("Плательщик не выбран")}</div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card className="mt-4">
              <CardContent className="space-y-4">
                <div className="text-sm font-semibold">{t("Фидбек по игре")}</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("Лучший игрок")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectablePlayers.map((player) => (
                        <Button
                          key={`best-${player.tg_id}`}
                          size="sm"
                          variant={feedback.best === String(player.tg_id) ? "default" : "outline"}
                          onClick={() =>
                            setFeedback((prev) => ({ ...prev, best: String(player.tg_id) }))
                          }
                        >
                          {player.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("Хуже всех")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectablePlayers.map((player) => (
                        <Button
                          key={`worst-${player.tg_id}`}
                          size="sm"
                          variant={feedback.worst === String(player.tg_id) ? "default" : "outline"}
                          onClick={() =>
                            setFeedback((prev) => ({ ...prev, worst: String(player.tg_id) }))
                          }
                        >
                          {player.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        id: "cmp_own",
                        label: t("Сравнение (своя команда)"),
                        pair: pickPair(myTeamSelectable, seedBase + 0 * 13)
                      },
                      {
                        id: "cmp_opp",
                        label: t("Сравнение (чужая команда)"),
                        pair: pickPair(oppTeam, seedBase + 1 * 13)
                      },
                      {
                        id: "cmp_cross",
                        label: t("Сравнение (своя vs чужая)"),
                        pair: pickPair(allPlayersSelectable, seedBase + 2 * 13)
                      }
                    ].map((cmp) => {
                      const [left, right] = cmp.pair;
                      return (
                        <Card key={cmp.id}>
                          <CardContent className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {cmp.label}
                            </div>
                            {left && right ? (
                              <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                                <Button
                                  size="sm"
                                  className="min-w-0 w-full truncate"
                                  variant={
                                    feedback[cmp.id] === String(left.tg_id) ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    setFeedback((prev) => ({
                                      ...prev,
                                      [cmp.id]: String(left.tg_id)
                                    }))
                                  }
                                >
                                  {left.name}
                                </Button>
                                <span className="text-center text-xs text-muted-foreground">vs</span>
                                <Button
                                  size="sm"
                                  className="min-w-0 w-full truncate"
                                  variant={
                                    feedback[cmp.id] === String(right.tg_id) ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    setFeedback((prev) => ({
                                      ...prev,
                                      [cmp.id]: String(right.tg_id)
                                    }))
                                  }
                                >
                                  {right.name}
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {t("Недостаточно игроков")}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("Дополнительные вопросы (без рейтинга)")}
                    </div>
                    <Card>
                      <CardContent className="space-y-2">
                        <div className="text-sm font-medium">
                          {t("Кто в твоей команде лучше всего сыгрался между собой?")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {myTeamSelectable.map((player) => {
                            const current = feedback.syn_team_a
                              ? [feedback.syn_team_a, feedback.syn_team_b].filter(Boolean)
                              : [];
                            const isSelected = current.includes(String(player.tg_id));
                            return (
                              <Button
                                key={`syn-team-${player.tg_id}`}
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => {
                                    const list = [prev.syn_team_a, prev.syn_team_b].filter(Boolean) as string[];
                                    const id = String(player.tg_id);
                                    if (list.includes(id)) {
                                      const next = list.filter((item) => item !== id);
                                      return { ...prev, syn_team_a: next[0], syn_team_b: next[1] };
                                    }
                                    if (list.length >= 2) return prev;
                                    const next = [...list, id];
                                    return { ...prev, syn_team_a: next[0], syn_team_b: next[1] };
                                  })
                                }
                              >
                                {player.name}
                              </Button>
                            );
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("Нужно выбрать двух игроков.")}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2">
                        <div className="text-sm font-medium">
                          {t("Какая пара у соперников выглядела самой сыгранной?")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {oppTeam.map((player) => {
                            const current = feedback.syn_opp_a
                              ? [feedback.syn_opp_a, feedback.syn_opp_b].filter(Boolean)
                              : [];
                            const isSelected = current.includes(String(player.tg_id));
                            return (
                              <Button
                                key={`syn-opp-${player.tg_id}`}
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => {
                                    const list = [prev.syn_opp_a, prev.syn_opp_b].filter(Boolean) as string[];
                                    const id = String(player.tg_id);
                                    if (list.includes(id)) {
                                      const next = list.filter((item) => item !== id);
                                      return { ...prev, syn_opp_a: next[0], syn_opp_b: next[1] };
                                    }
                                    if (list.length >= 2) return prev;
                                    const next = [...list, id];
                                    return { ...prev, syn_opp_a: next[0], syn_opp_b: next[1] };
                                  })
                                }
                              >
                                {player.name}
                              </Button>
                            );
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("Нужно выбрать двух игроков.")}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2">
                        <div className="text-sm font-medium">
                          {t("Кто кого переиграл? (ваша команда → соперник)")}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-wrap gap-2">
                            <div className="w-full text-xs text-muted-foreground">
                              {t("Кто доминировал")}
                            </div>
                            {myTeamSelectable.map((player) => (
                              <Button
                                key={`dom-my-${player.tg_id}`}
                                size="sm"
                                variant={feedback.dom_my === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({ ...prev, dom_my: String(player.tg_id) }))
                                }
                              >
                                {player.name}
                              </Button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="w-full text-xs text-muted-foreground">
                              {t("Над кем доминировал")}
                            </div>
                            {oppTeam.map((player) => (
                              <Button
                                key={`dom-my-target-${player.tg_id}`}
                                size="sm"
                                variant={feedback.dom_opp_target === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({
                                    ...prev,
                                    dom_opp_target: String(player.tg_id)
                                  }))
                                }
                              >
                                {player.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2">
                        <div className="text-sm font-medium">
                          {t("Кто кого переиграл? (соперник → ваша команда)")}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-wrap gap-2">
                            <div className="w-full text-xs text-muted-foreground">
                              {t("Кто доминировал")}
                            </div>
                            {oppTeam.map((player) => (
                              <Button
                                key={`dom-opp-${player.tg_id}`}
                                size="sm"
                                variant={feedback.dom_opp === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({ ...prev, dom_opp: String(player.tg_id) }))
                                }
                              >
                                {player.name}
                              </Button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="w-full text-xs text-muted-foreground">
                              {t("Над кем доминировал")}
                            </div>
                            {myTeamSelectable.map((player) => (
                              <Button
                                key={`dom-opp-target-${player.tg_id}`}
                                size="sm"
                                variant={feedback.dom_my_target === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({
                                    ...prev,
                                    dom_my_target: String(player.tg_id)
                                  }))
                                }
                              >
                                {player.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2">
                        <div className="text-sm font-medium">{roleQuestion.text}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectablePlayers.map((player) => (
                            <Button
                              key={`role-${player.tg_id}`}
                              size="sm"
                              variant={feedback.role_player === String(player.tg_id) ? "default" : "outline"}
                              onClick={() =>
                                setFeedback((prev) => ({
                                  ...prev,
                                  role_player: String(player.tg_id),
                                  role_type: roleQuestion.role
                                }))
                              }
                            >
                              {player.name}
                            </Button>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("Выберите одного игрока.")}
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={async () => {
                          if (!matchId) return;
                          try {
                            setFeedbackStatus("saving");
                            await submitFeedback(Number(matchId), feedbackPayload);
                            setFeedbackStatus("saved");
                          } catch (err) {
                            setFeedbackStatus("idle");
                            setError(formatApiError(err));
                          }
                        }}
                      >
                        {feedbackStatus === "saving" ? t("Сохраняю...") : t("Сохранить фидбек")}
                      </Button>
                      {feedbackStatus === "saved" ? (
                        <span className="text-xs text-muted-foreground">{t("Сохранено")}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="events">{eventsTimeline}</TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          {simpleScore}
          {eventsTimeline}
        </div>
      )}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Отчет по оплатам")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {playersOnly.map((member) => {
              const status =
                paymentStatuses.find((item) => item.tg_id === member.tg_id)?.status || "unpaid";
              return (
                <div key={member.tg_id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{statusLabel(status)}</div>
                  </div>
                  {isPayer && member.tg_id !== data?.me.tg_id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!matchId) return;
                          try {
                            setReportLoading(true);
                            await confirmPayment(Number(matchId), {
                              tg_id: member.tg_id,
                              approved: true
                            });
                            const refreshed = await getMatch(Number(matchId));
                            setData(refreshed);
                          } catch (err) {
                            setError(formatApiError(err));
                          } finally {
                            setReportLoading(false);
                          }
                        }}
                        disabled={reportLoading}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!matchId) return;
                          try {
                            setReportLoading(true);
                            await confirmPayment(Number(matchId), {
                              tg_id: member.tg_id,
                              approved: false
                            });
                            const refreshed = await getMatch(Number(matchId));
                            setData(refreshed);
                          } catch (err) {
                            setError(formatApiError(err));
                          } finally {
                            setReportLoading(false);
                          }
                        }}
                        disabled={reportLoading}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
