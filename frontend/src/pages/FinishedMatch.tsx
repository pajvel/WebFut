import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { confirmPayment, getFeedback, getMatch, markPaid, payerDetails, payerSelect, submitFeedback } from "../lib/api";
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
  const [payerSelectOpen, setPayerSelectOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string | string[]>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [comparisonPairsState, setComparisonPairsState] = useState<{
    cmp_own?: number[];
    cmp_opp?: number[];
    cmp_cross?: number[];
  }>({});
  const [mvpHelpOpen, setMvpHelpOpen] = useState(false);
  const [statsScope, setStatsScope] = useState<"all" | "A" | "B">("all");

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
        const pairs = (answers.comparison_pairs || {}) as Record<string, unknown>;
        const toPair = (value: unknown) => {
          if (!Array.isArray(value)) return undefined;
          return value.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
        };
        setComparisonPairsState({
          cmp_own: toPair(pairs.cmp_own),
          cmp_opp: toPair(pairs.cmp_opp),
          cmp_cross: toPair(pairs.cmp_cross)
        });
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
  const playersOnly = useMemo(
    () => data?.members.filter((member) => member.role !== "spectator") || [],
    [data]
  );
  const isOrganizer = !!(data && (data.me.is_admin || myMember?.role === "organizer"));
  const payerInfo = data?.payments?.payer || null;
  
  // Отладочные логи
  console.log('[FINISHED MATCH] Debug info:', {
    matchId,
    me: data?.me,
    myMember,
    isOrganizer,
    payerInfo,
    playersOnly: playersOnly.map(p => ({ name: p.name, role: p.role, tg_id: p.tg_id }))
  });
  const isPayer = !!(payerInfo && payerInfo.payer_tg_id === data?.me.tg_id);
  const paymentStatuses = data?.payments?.statuses || [];
  const myPaymentStatus = paymentStatuses.find((item) => item.tg_id === data?.me.tg_id)?.status || "unpaid";
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

  const mvpTrack = useMemo(() => {
    const mvpVotes = data?.mvp?.votes || {};
    const worstVotes = data?.mvp?.worst_votes || {};
    const ids = new Set([...Object.keys(mvpVotes), ...Object.keys(worstVotes)]);
    if (!ids.size) return { items: [], maxAbs: 1 };

    const memberById = new Map(
      (data?.members || []).map((member) => [String(member.tg_id), member])
    );
    const topId = data?.mvp?.top_tg_id ? String(data.mvp.top_tg_id) : null;
    const raw = Array.from(ids).map((id) => {
      const mvpCount = mvpVotes[id] || 0;
      const worstCount = worstVotes[id] || 0;
      const net = mvpCount - worstCount;
      const member = memberById.get(id);
      return {
        id,
        tg_id: Number(id),
        name: member?.name || id,
        avatar: member?.avatar || null,
        mvpCount,
        worstCount,
        net,
        isTopMvp: topId === id
      };
    });

    const maxAbs = Math.max(1, ...raw.map((item) => Math.abs(item.net)));
    const grouped = new Map<number, typeof raw>();
    raw.forEach((item) => {
      const list = grouped.get(item.net) || [];
      list.push(item);
      grouped.set(item.net, list);
    });

    const items: Array<
      (typeof raw)[number] & { stackIndex: number; stackCount: number; groupHasTop: boolean }
    > = [];
    grouped.forEach((list) => {
      const hasTop = list.some((entry) => entry.isTopMvp);
      list.sort((a, b) => {
        if (a.isTopMvp !== b.isTopMvp) return a.isTopMvp ? -1 : 1;
        if (a.mvpCount !== b.mvpCount) return b.mvpCount - a.mvpCount;
        return a.worstCount - b.worstCount;
      });
      list.forEach((item, index) => {
        items.push({ ...item, stackIndex: index, stackCount: list.length, groupHasTop: hasTop });
      });
    });

    return { items, maxAbs };
  }, [data?.members, data?.mvp]);

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
  const initials = (name?: string | null) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "??";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  };
  const hasAvatar = (value?: string | null) => {
    if (!value) return false;
    const trimmed = value.trim();
    return Boolean(trimmed && trimmed.toLowerCase() !== "null");
  };
  const allPlayers = useMemo(
    () => [...teamMembers.A, ...teamMembers.B],
    [teamMembers]
  );
  const memberById = (id?: number | null) =>
    id ? allPlayers.find((player) => player.tg_id === id) || null : null;
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
  const statLeaders = useMemo(() => {
    const goals = new Map<number, number>();
    const assists = new Map<number, number>();
    const members = data?.members || [];
    const teamMembersLocal = (() => {
      if (!data) return members;
      if (statsScope === "A") return teamMembers.A;
      if (statsScope === "B") return teamMembers.B;
      return members;
    })();
    const allowedIds = new Set(teamMembersLocal.map((member) => member.tg_id));
    const byId = new Map(members.map((member) => [member.tg_id, member]));

    (data?.events || []).forEach((event) => {
      if (event.event_type === "own_goal") return;
      if (event.scorer_tg_id && allowedIds.has(event.scorer_tg_id)) {
        goals.set(event.scorer_tg_id, (goals.get(event.scorer_tg_id) || 0) + 1);
      }
      if (event.assist_tg_id && allowedIds.has(event.assist_tg_id)) {
        assists.set(event.assist_tg_id, (assists.get(event.assist_tg_id) || 0) + 1);
      }
    });

    const toEntries = () =>
      teamMembersLocal.map((member) => ({
        tg_id: member.tg_id,
        name: member.name,
        avatar: member.avatar,
        goals: goals.get(member.tg_id) || 0,
        assists: assists.get(member.tg_id) || 0
      }));

    const podium = (items: ReturnType<typeof toEntries>, key: "total" | "goals" | "assists") => {
      const withTotals = items.map((item) => ({
        ...item,
        total: item.goals + item.assists
      }));
      withTotals.sort((a, b) => {
        if (key === "total") {
          if (b.total !== a.total) return b.total - a.total;
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.assists - a.assists;
        }
        if (key === "goals") {
          if (b.goals !== a.goals) return b.goals - a.goals;
          if (b.assists !== a.assists) return b.assists - a.assists;
          return b.total - a.total;
        }
        if (b.assists !== a.assists) return b.assists - a.assists;
        if (b.goals !== a.goals) return b.goals - a.goals;
        return b.total - a.total;
      });
      return withTotals.slice(0, 3);
    };

    const items = toEntries();
    return {
      byId,
      total: podium(items, "total"),
      goals: podium(items, "goals"),
      assists: podium(items, "assists")
    };
  }, [data, statsScope, teamMembers]);

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
  const pickCrossPair = (leftPool: MatchMember[], rightPool: MatchMember[], seed: number) => {
    if (!leftPool.length || !rightPool.length) return [null, null] as const;
    const left = leftPool[pickIndex(leftPool.length, seed)];
    const right = rightPool[pickIndex(rightPool.length, seed + 11)];
    return [left, right] as const;
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
    const pairToIds = (pair: readonly (MatchMember | null)[]) =>
      pair[0] && pair[1] ? [pair[0].tg_id, pair[1].tg_id] : [];
    const normalizePair = (pair?: number[]) =>
      pair && pair.length === 2 && pair[0] !== pair[1] ? pair : null;
    const rolePlayer = toNumber(feedback.role_player);
    const roleType = roleQuestion.role;
    const fallbackPairs = {
      cmp_own: pairToIds(pickPair(myTeamSelectable, seedBase + 0 * 13)),
      cmp_opp: pairToIds(pickPair(oppTeam, seedBase + 1 * 13)),
      cmp_cross: pairToIds(pickCrossPair(myTeamSelectable, oppTeam, seedBase + 2 * 13))
    };
    const comparisonPairs = {
      cmp_own: normalizePair(comparisonPairsState.cmp_own) ?? fallbackPairs.cmp_own,
      cmp_opp: normalizePair(comparisonPairsState.cmp_opp) ?? fallbackPairs.cmp_opp,
      cmp_cross: normalizePair(comparisonPairsState.cmp_cross) ?? fallbackPairs.cmp_cross
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
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div className="space-y-2 min-w-0">
            {teamMembers.A.map((member) => (
              <Link
                key={member.tg_id}
                to={`/matches/${matchId}/players/${member.tg_id}`}
                className="flex items-center gap-2 min-w-0"
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
          <div className="space-y-2 min-w-0">
            {teamMembers.B.map((member) => (
              <Link
                key={member.tg_id}
                to={`/matches/${matchId}/players/${member.tg_id}`}
                className="flex items-center gap-2 justify-end min-w-0"
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

  const playerName = (tgId?: number | null) => {
    if (!tgId) return null;
    return data?.members.find((m) => m.tg_id === tgId)?.name || String(tgId);
  };
  const playerById = (tgId?: number | null) => {
    if (!tgId) return null;
    return data?.members.find((m) => m.tg_id === tgId) || null;
  };
  const startScoreForSegment = (segNo: number) => {
    let a = 0;
    let b = 0;
    for (const seg of data?.segments || []) {
      if (seg.seg_no >= segNo) break;
      a += seg.score_a || 0;
      b += seg.score_b || 0;
    }
    return { A: a, B: b };
  };

  const eventsTimeline = (
    <div className="space-y-3">
      {eventsBySegment.map((seg) => (
        <Card key={seg.id}>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {t("Отрезок")} {seg.seg_no}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-semibold">
                <span>{teamNames.A}</span>
                <span className="text-muted-foreground">•</span>
                <span>{seg.score_a}</span>
                <span className="text-muted-foreground">:</span>
                <span>{seg.score_b}</span>
                <span className="text-muted-foreground">•</span>
                <span>{teamNames.B}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {seg.is_butt_game ? t("Игра на жопу") : t("Обычный")}
            </div>
            <div className="space-y-2 text-sm">
              {seg.events.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t("Событий нет")}</div>
              ) : (
                seg.events.map((ev, index) => {
                  const baseScore = startScoreForSegment(seg.seg_no);
                  const running = { ...baseScore };
                  for (let i = 0; i <= index; i += 1) {
                    const e = seg.events[i];
                    const own = e.event_type === "own_goal";
                    const team =
                      own ? (e.team === "A" ? "B" : "A") : e.team;
                    if (team === "A") running.A += 1;
                    if (team === "B") running.B += 1;
                  }
                  const isOwnGoal = ev.event_type === "own_goal";
                  const displayTeam = isOwnGoal ? (ev.team === "A" ? "B" : "A") : ev.team;
                  const scorer = playerName(ev.scorer_tg_id);
                  const assist = playerName(ev.assist_tg_id);
                  const scorerMember = playerById(ev.scorer_tg_id);
                  const assistMember = playerById(ev.assist_tg_id);
                  return (
                    <div
                      key={ev.id}
                      className="grid items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-full border border-border/60 bg-card/80 px-2 py-0.5 text-[11px] font-semibold">
                          {isOwnGoal ? t("АГ") : t("ГОЛ")}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {teamNames[displayTeam as "A" | "B"] || t("Команда")}
                        </span>
                        <span className="text-[11px] font-semibold text-foreground">
                          {running.A}:{running.B}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {scorerMember ? (
                            <Link
                              to={`/matches/${matchId}/players/${scorerMember.tg_id}`}
                              className="shrink-0"
                            >
                              <Avatar className="h-7 w-7 border border-border">
                                {scorerMember.avatar ? (
                                  <AvatarImage src={resolveMediaUrl(scorerMember.avatar)} />
                                ) : null}
                                <AvatarFallback>
                                  {scorerMember.name?.slice(0, 2).toUpperCase() || "??"}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                          ) : (
                            <Avatar className="h-7 w-7 border border-border">
                              <AvatarFallback>??</AvatarFallback>
                            </Avatar>
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] text-muted-foreground">{t("Гол")}</div>
                            <div className="truncate font-medium">{scorer ? scorer : t("Неизвестный")}</div>
                          </div>
                        </div>
                        {assistMember ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Link
                              to={`/matches/${matchId}/players/${assistMember.tg_id}`}
                              className="shrink-0"
                            >
                              <Avatar className="h-7 w-7 border border-border">
                                {assistMember.avatar ? (
                                  <AvatarImage src={resolveMediaUrl(assistMember.avatar)} />
                                ) : null}
                                <AvatarFallback>
                                  {assistMember.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                            <div className="min-w-0">
                              <div className="text-[11px] text-muted-foreground">{t("Ассист")}</div>
                              <div className="truncate text-sm">{assist}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div />
                    </div>
                  );
                })
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events" className="justify-center min-w-0 px-2 text-xs sm:text-sm truncate">
              {t("События")}
            </TabsTrigger>
            <TabsTrigger value="summary" className="justify-center min-w-0 px-2 text-xs sm:text-sm truncate">
              {t("Итог")}
            </TabsTrigger>
            <TabsTrigger value="best" className="justify-center min-w-0 px-2 text-xs sm:text-sm truncate">
              {t("Лучшие")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            {summary}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-2">
                  <div className="text-sm font-semibold">{t("Плательщик")}</div>
                  {payerInfo ? (
                    <div className="space-y-2 text-sm">
                      {isOrganizer ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPayerSelectOpen(true)}
                          className="w-full"
                        >
                          {t("Поменять плательщика")}
                        </Button>
                      ) : null}
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
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">{t("Плательщик не выбран")}</div>
                      {isOrganizer ? (
                        <Button
                          size="sm"
                          onClick={() => setPayerSelectOpen(true)}
                          className="w-full"
                        >
                          {t("Выбрать плательщика")}
                        </Button>
                      ) : null}
                    </div>
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
                          className="gap-2"
                          variant={feedback.best === String(player.tg_id) ? "default" : "outline"}
                          onClick={() =>
                            setFeedback((prev) => ({ ...prev, best: String(player.tg_id) }))
                          }
                        >
                          <Avatar className="h-6 w-6 border border-border">
                            {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                            <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{player.name}</span>
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
                          className="gap-2"
                          variant={feedback.worst === String(player.tg_id) ? "default" : "outline"}
                          onClick={() =>
                            setFeedback((prev) => ({ ...prev, worst: String(player.tg_id) }))
                          }
                        >
                          <Avatar className="h-6 w-6 border border-border">
                            {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                            <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{player.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        id: "cmp_own",
                        label: t("Сравнение (своя команда)"),
                        pair:
                          comparisonPairsState.cmp_own?.length === 2
                            ? ([
                                memberById(comparisonPairsState.cmp_own[0]),
                                memberById(comparisonPairsState.cmp_own[1])
                              ] as const)
                            : pickPair(myTeamSelectable, seedBase + 0 * 13)
                      },
                      {
                        id: "cmp_opp",
                        label: t("Сравнение (чужая команда)"),
                        pair:
                          comparisonPairsState.cmp_opp?.length === 2
                            ? ([
                                memberById(comparisonPairsState.cmp_opp[0]),
                                memberById(comparisonPairsState.cmp_opp[1])
                              ] as const)
                            : pickPair(oppTeam, seedBase + 1 * 13)
                      },
                      {
                        id: "cmp_cross",
                        label: t("Сравнение (своя vs чужая)"),
                        pair:
                          comparisonPairsState.cmp_cross?.length === 2
                            ? ([
                                memberById(comparisonPairsState.cmp_cross[0]),
                                memberById(comparisonPairsState.cmp_cross[1])
                              ] as const)
                            : pickCrossPair(myTeamSelectable, oppTeam, seedBase + 2 * 13)
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
                                  className="min-w-0 w-full truncate gap-2"
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
                                  <Avatar className="h-6 w-6 border border-border">
                                    {left.avatar ? <AvatarImage src={resolveMediaUrl(left.avatar)} /> : null}
                                    <AvatarFallback>{left.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{left.name}</span>
                                </Button>
                                <span className="text-center text-xs text-muted-foreground">vs</span>
                                <Button
                                  size="sm"
                                  className="min-w-0 w-full truncate gap-2"
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
                                  <Avatar className="h-6 w-6 border border-border">
                                    {right.avatar ? <AvatarImage src={resolveMediaUrl(right.avatar)} /> : null}
                                    <AvatarFallback>{right.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{right.name}</span>
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
                                className="gap-2"
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
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                                className="gap-2"
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
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                                className="gap-2"
                                variant={feedback.dom_my === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({ ...prev, dom_my: String(player.tg_id) }))
                                }
                              >
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                                className="gap-2"
                                variant={feedback.dom_opp_target === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({
                                    ...prev,
                                    dom_opp_target: String(player.tg_id)
                                  }))
                                }
                              >
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                                className="gap-2"
                                variant={feedback.dom_opp === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({ ...prev, dom_opp: String(player.tg_id) }))
                                }
                              >
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                                className="gap-2"
                                variant={feedback.dom_my_target === String(player.tg_id) ? "default" : "outline"}
                                onClick={() =>
                                  setFeedback((prev) => ({
                                    ...prev,
                                    dom_my_target: String(player.tg_id)
                                  }))
                                }
                              >
                                <Avatar className="h-6 w-6 border border-border">
                                  {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{player.name}</span>
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
                              className="gap-2"
                              variant={feedback.role_player === String(player.tg_id) ? "default" : "outline"}
                              onClick={() =>
                                setFeedback((prev) => ({
                                  ...prev,
                                  role_player: String(player.tg_id),
                                  role_type: roleQuestion.role
                                }))
                              }
                            >
                              <Avatar className="h-6 w-6 border border-border">
                                {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                                <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{player.name}</span>
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
          <TabsContent value="best">
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{t("MVP")}</div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 rounded-full"
                      aria-label={t("Как считается MVP")}
                      onClick={() => setMvpHelpOpen(true)}
                    >
                      ?
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("Голосование завершится через")} {mvpCountdown?.hours ?? 0}ч{" "}
                    {mvpCountdown?.minutes ?? 0}м
                  </div>
                  {(() => {
                    const numberHeight = 12;
                    const numberMargin = 4;
                    const numberTotal = numberHeight + numberMargin;
                    const belowGap = 26;
                    const baseOffset = 30;
                    const lineY = 40;
                    const avatarSize = 24;
                    const topLift = 6;
                    const baseHeight = 80;
                    let maxOverflow = 0;

                    mvpTrack.items.forEach((item) => {
                      const isGroupLeader = item.groupHasTop ? item.isTopMvp : item.stackIndex === 0;
                      const nonLeaderIndex = item.groupHasTop
                        ? item.isTopMvp
                          ? -1
                          : item.stackIndex - 1
                        : item.stackIndex - 1;
                      const translateY = isGroupLeader
                        ? item.isTopMvp
                          ? -topLift
                          : 0
                        : baseOffset + numberTotal + nonLeaderIndex * belowGap;
                      const iconBottom = lineY + avatarSize / 2 + translateY;
                      maxOverflow = Math.max(maxOverflow, iconBottom - baseHeight);
                    });

                    const containerHeight = baseHeight;
                    const labelMarginTop = Math.max(0, maxOverflow) + 5;

                    return (
                      <>
                        <div className="relative mt-2" style={{ height: containerHeight, overflow: "visible" }}>
                          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
                          <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border" />
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-2 text-[10px] text-muted-foreground">
                            0
                          </div>
                          {mvpTrack.items.map((item) => {
                            const position = 50 + (item.net / mvpTrack.maxAbs) * 45;
                            const clamped = Math.min(95, Math.max(5, position));
                            const isGroupLeader = item.groupHasTop ? item.isTopMvp : item.stackIndex === 0;
                            const showNumber = isGroupLeader;
                            const nonLeaderIndex = item.groupHasTop
                              ? item.isTopMvp
                                ? -1
                                : item.stackIndex - 1
                              : item.stackIndex - 1;
                            const belowOffset =
                              nonLeaderIndex >= 0 ? baseOffset + numberTotal + nonLeaderIndex * belowGap : 0;
                            const avatarTranslate = isGroupLeader
                              ? item.isTopMvp
                                ? `translate(-50%, calc(-50% - ${topLift}px))`
                                : "translate(-50%, -50%)"
                              : `translate(-50%, calc(-50% + ${belowOffset}px))`;
                            return (
                              <div key={item.id} className="absolute top-1/2" style={{ left: `${clamped}%` }}>
                                <div
                                  className="relative"
                                  style={{
                                    transform: avatarTranslate
                                  }}
                                >
                                  {item.isTopMvp ? (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">👑</div>
                                  ) : null}
                                  <Link
                                    to={`/matches/${matchId}/players/${item.tg_id}`}
                                    className="block"
                                  >
                                    <Avatar className="h-6 w-6 border border-border">
                                      {item.avatar ? (
                                        <AvatarImage src={resolveMediaUrl(item.avatar)} />
                                      ) : null}
                                      <AvatarFallback>
                                        {item.name.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </Link>
                                  {showNumber ? (
                                    <div
                                      className="absolute left-1/2 top-full -translate-x-1/2 text-[10px] font-semibold leading-none"
                                      style={{
                                        marginTop: numberMargin,
                                        height: numberHeight,
                                        lineHeight: `${numberHeight}px`
                                      }}
                                    >
                                      {item.net > 0 ? `+${item.net}` : item.net}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {mvpTrack.items.length ? (
                          <div className="text-xs text-muted-foreground" style={{ marginTop: labelMarginTop }}>
                            {t("Текущий лидер")}:{" "}
                            {data.mvp?.top_tg_id
                              ? data.members.find((m) => m.tg_id === data.mvp?.top_tg_id)?.name || data.mvp?.top_tg_id
                              : t("нет")}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground" style={{ marginTop: labelMarginTop }}>
                            {t("Пока нет голосов")}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "total", title: t("Гол + пас"), data: statLeaders.total },
                  { key: "goals", title: t("Голы"), data: statLeaders.goals },
                  { key: "assists", title: t("Ассисты"), data: statLeaders.assists }
                ].map((block) => (
                  <Card key={block.key}>
                    <CardContent className="space-y-3">
                      <div className="text-sm font-semibold">{block.title}</div>
                      {block.data.length === 0 ? (
                        <div className="text-xs text-muted-foreground">{t("Пока нет данных")}</div>
                      ) : (
                        <div className="flex items-end justify-between gap-2">
                          {(() => {
                            const first = block.data[0];
                            const second = block.data[1];
                            const third = block.data[2];
                            const getValue = (entry: typeof first | undefined) => {
                              if (!entry) return "0";
                              if (block.key === "total") return String(entry.goals + entry.assists);
                              if (block.key === "goals") return String(entry.goals);
                              return String(entry.assists);
                            };
                            const slots = [
                              { entry: second, place: 2, height: "h-14" },
                              { entry: first, place: 1, height: "h-20" },
                              { entry: third, place: 3, height: "h-12" }
                            ];
                            return slots.map((slot) => (
                              <div key={`${block.key}-podium-${slot.place}`} className="flex min-w-0 flex-1 flex-col items-center">
                                {slot.entry ? (
                                  <Link
                                    to={`/matches/${matchId}/players/${slot.entry.tg_id}`}
                                    className="block"
                                  >
                                    {hasAvatar(slot.entry.avatar) ? (
                                      <Avatar className="h-8 w-8 border border-border">
                                        <AvatarImage src={resolveMediaUrl(slot.entry.avatar)} />
                                        <AvatarFallback delayMs={0}>
                                          {initials(slot.entry.name || String(slot.entry.tg_id))}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold uppercase leading-none">
                                        {initials(slot.entry.name || String(slot.entry.tg_id))}
                                      </div>
                                    )}
                                  </Link>
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold uppercase leading-none">
                                    --
                                  </div>
                                )}
                                <div className="mt-1 text-[11px] font-semibold text-foreground">
                                  {getValue(slot.entry)}
                                </div>
                                <div className={`mt-2 w-full rounded-t-lg border border-border/60 bg-card/70 ${slot.height}`} />
                                <div className="mt-2 flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-[10px] font-semibold">
                                  {slot.place}
                                </div>
                                <div className="mt-1 h-4 w-full" />
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="flex justify-start">
                  <Button
                    size="sm"
                    variant={statsScope === "A" ? "default" : "outline"}
                    onClick={() => setStatsScope("A")}
                    className="max-w-full truncate"
                  >
                    {teamNames.A}
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant={statsScope === "all" ? "default" : "outline"}
                    onClick={() => setStatsScope("all")}
                  >
                    {t("Общая")}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={statsScope === "B" ? "default" : "outline"}
                    onClick={() => setStatsScope("B")}
                    className="max-w-full truncate"
                  >
                    {teamNames.B}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
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

      {/* Диалог выбора плательщика */}
      <Dialog open={payerSelectOpen} onOpenChange={setPayerSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Кому предложить оплату?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {playersOnly.map((member) => (
              <div
                key={member.tg_id}
                className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <span>{member.name}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!matchId) return;
                    console.log('[PAYER SELECT] Selecting payer:', member.tg_id, 'for match:', matchId);
                    try {
                      await payerSelect(Number(matchId), member.tg_id);
                      console.log('[PAYER SELECT] Selection successful');
                      setPayerSelectOpen(false);
                      const refreshed = await getMatch(Number(matchId));
                      console.log('[PAYER SELECT] Data refreshed:', refreshed);
                      setData(refreshed);
                    } catch (err) {
                      console.error('[PAYER SELECT] Error:', err);
                      setError(formatApiError(err));
                    }
                  }}
                >
                  {t("Предложить")}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={mvpHelpOpen} onOpenChange={setMvpHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Как считается MVP")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>{t("Главное — голоса за MVP. У кого их больше, тот и лидер.")}</div>
            <div>{t("Если голоса равны, сравниваются полезные действия: голы + ассисты.")}</div>
            <div>{t("Если и это равно, выше тот, у кого больше голов.")}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
