import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  confirmPayment,
  getFeedback,
  getMatch,
  markPaid,
  payerDetails,
  payerSelect,
  remindPayments,
  submitFeedback
} from "../lib/api";
import type { MatchDetail, MatchMember, MatchEvent as ApiMatchEvent } from "../lib/types";
import { formatApiError } from "../lib/errors";
import { resolveMediaUrl } from "../lib/media";
import { StatusCard } from "../components/StatusCard";
import { useMatText } from "../lib/mode18";
import { formatVenueLabel } from "../lib/venue";
import { formatDateShortMsk, formatTimeMsk } from "../lib/datetime";

enum MatchTab {
  RESULT = "RESULT",
  EVENTS = "EVENTS",
  BEST = "BEST"
}

type PaymentStatusLabel = "unpaid" | "reported_paid" | "confirmed" | "rejected" | "pending";

type Player = {
  id: string;
  tg_id: number;
  name: string;
  avatar: string | null;
  elo: number;
  goals: number;
  assists: number;
  paymentStatus: PaymentStatusLabel;
  mvpVotes: number;
};

type MatchEventUi = {
  id: string;
  type: "goal" | "own_goal";
  player: string;
  assist?: string;
  team: "A" | "B";
  scoreAfter: string;
  time: string;
  period: string;
};

type MatchDataUi = {
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  date: string;
  time: string;
  status: string;
  location: string;
  isLastSegmentButt: boolean;
  periods: string[];
  teamA: Player[];
  teamB: Player[];
  events: MatchEventUi[];
  payer: {
    payerTgId: number | null;
    payerName: string;
    fio: string;
    phone: string;
    bank: string;
    amount: number | null;
    perPerson: number | null;
  };
};

const CROWN_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V18H19V19Z" />
  </svg>
);
const toUpperShortDate = (value: string | null) => {
  return formatDateShortMsk(value).toUpperCase();
};

const toTime = (value: string | null) => {
  return formatTimeMsk(value);
};

const formatStatus = (status: MatchDetail["match"]["status"]) => {
  if (status === "finished") return "FINISHED";
  if (status === "live") return "LIVE";
  if (status === "generating") return "GENERATING";
  return "CREATED";
};

const paymentStatusLabel = (status: PaymentStatusLabel) => {
  if (status === "reported_paid") return "ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ";
  if (status === "confirmed") return "ПОДТВЕРЖДЕНО";
  if (status === "rejected") return "ОТКЛОНЕНО";
  if (status === "pending") return "В ОБРАБОТКЕ";
  return "НЕ ОПЛАЧЕНО";
};


const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  const oneWord = parts[0] || "";
  if (oneWord.length >= 2) return oneWord.slice(0, 2).toUpperCase();
  const ch = oneWord[0]?.toUpperCase() || "?";
  return `${ch}${ch}`;
};

export function FinishedMatch() {
  const { matchId } = useParams();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [payerForm, setPayerForm] = useState({ fio: "", phone: "", bank: "", amount: "" });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [payerSelectOpen, setPayerSelectOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string | string[]>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState<MatchTab>(MatchTab.RESULT);

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
        if (answers.best_attacker) next.best_attacker = String(answers.best_attacker);
        if (answers.best_defender) next.best_defender = String(answers.best_defender);
        const roleVote = (answers.role_vote || {}) as Record<string, unknown>;
        if (roleVote.player_id && roleVote.role === "attacker") {
          next.best_attacker = String(roleVote.player_id);
        }
        if (roleVote.player_id && roleVote.role === "defender") {
          next.best_defender = String(roleVote.player_id);
        }
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
      bank: data.payments.payer.payer_bank || "",
      amount: data.payments.payer.payer_amount == null ? "" : String(data.payments.payer.payer_amount)
    });
  }, [data]);

  useEffect(() => {
    const id = window.setInterval(() => setTimerTick((prev) => prev + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const score = useMemo(() => {
    if (!data) return { A: 0, B: 0 };
    const lastSegment = [...data.segments].reverse().find((seg) => seg.ended_at) || data.segments[data.segments.length - 1];
    if (!lastSegment) return { A: 0, B: 0 };
    return { A: lastSegment.score_a, B: lastSegment.score_b };
  }, [data]);

  const teamNames = useMemo(() => {
    const current = data?.team_current?.current_teams as { name_a?: string; name_b?: string } | undefined;
    return {
      A: current?.name_a || "TEAM A",
      B: current?.name_b || "TEAM B"
    };
  }, [data]);

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

  const allMembers = useMemo(() => [...teamMembers.A, ...teamMembers.B], [teamMembers]);

  const myMember = useMemo(
    () => data?.members.find((m) => m.tg_id === data?.me.tg_id) || null,
    [data]
  );

  const myTeamKey = useMemo(() => {
    if (!myMember) return "A";
    const isA = teamMembers.A.some((member) => member.tg_id === myMember.tg_id);
    return isA ? "A" : "B";
  }, [myMember, teamMembers]);

  const myTeam = myTeamKey === "A" ? teamMembers.A : teamMembers.B;
  const oppTeam = myTeamKey === "A" ? teamMembers.B : teamMembers.A;

  const isAdmin = !!data?.me.is_admin;
  const isOrganizer = myMember?.role === "organizer";
  const payerInfo = data?.payments?.payer || null;
  const isPayer = !!(payerInfo && payerInfo.payer_tg_id === data?.me.tg_id);

  const paymentStatuses = data?.payments?.statuses || [];
  const myPaymentStatus = paymentStatuses.find((item) => item.tg_id === data?.me.tg_id)?.status || "unpaid";

  const goalsAssists = useMemo(() => {
    const goals = new Map<number, number>();
    const assists = new Map<number, number>();
    (data?.events || []).forEach((event) => {
      if (event.event_type !== "goal") return;
      if (event.scorer_tg_id) {
        goals.set(event.scorer_tg_id, (goals.get(event.scorer_tg_id) || 0) + 1);
      }
      if (event.assist_tg_id) {
        assists.set(event.assist_tg_id, (assists.get(event.assist_tg_id) || 0) + 1);
      }
    });
    return { goals, assists };
  }, [data]);

  const mvpVotes = data?.mvp?.votes || {};
  const worstVotes = data?.mvp?.worst_votes || {};

  const playerById = useMemo(() => {
    const map = new Map<number, MatchMember>();
    (data?.members || []).forEach((member) => map.set(member.tg_id, member));
    return map;
  }, [data]);

  const matchUi = useMemo<MatchDataUi | null>(() => {
    if (!data) return null;
    const memberToPlayer = (member: MatchMember): Player => {
      const status = paymentStatuses.find((item) => item.tg_id === member.tg_id)?.status || "unpaid";
      const netVotes = (mvpVotes[String(member.tg_id)] || 0) - (worstVotes[String(member.tg_id)] || 0);
      return {
        id: String(member.tg_id),
        tg_id: member.tg_id,
        name: member.name,
        avatar: member.avatar,
        elo: member.rating ?? 0,
        goals: goalsAssists.goals.get(member.tg_id) || 0,
        assists: goalsAssists.assists.get(member.tg_id) || 0,
        paymentStatus: status as PaymentStatusLabel,
        mvpVotes: netVotes
      };
    };

    const allEvents = [...data.events].sort((a, b) => {
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id - b.id;
    });
    let runningA = 0;
    let runningB = 0;

    const formatSegmentLabel = (segNo: number, isButtGame: boolean) =>
      isButtGame ? `СЕГМЕНТ ${segNo} • НА ЖОПУ` : `СЕГМЕНТ ${segNo}`;

    const segmentLabel = new Map<number, string>();
    data.segments.forEach((seg) => {
      segmentLabel.set(seg.id, formatSegmentLabel(seg.seg_no, seg.is_butt_game));
    });

    const eventToUi = (event: ApiMatchEvent): MatchEventUi => {
      const scorer = event.scorer_tg_id ? playerById.get(event.scorer_tg_id)?.name || "" : "";
      const assist = event.assist_tg_id ? playerById.get(event.assist_tg_id)?.name || "" : undefined;
      const isOwn = event.event_type === "own_goal";
      const team = event.team;
      if (isOwn) {
        if (team === "A") runningB += 1;
        if (team === "B") runningA += 1;
      } else {
        if (team === "A") runningA += 1;
        if (team === "B") runningB += 1;
      }
      return {
        id: String(event.id),
        type: event.event_type,
        player: scorer || "UNKNOWN",
        assist: assist || undefined,
        team,
        scoreAfter: `${runningA} : ${runningB}`,
        time: toTime(event.created_at),
        period: segmentLabel.get(event.segment_id) || "СЕГМЕНТ"
      };
    };

    const eventUi = allEvents.map(eventToUi);

    const baseDate = data.match.finished_at || data.match.scheduled_at || data.match.created_at;
    const lastSegment = data.segments[data.segments.length - 1] || null;

    return {
      teamAName: teamNames.A,
      teamBName: teamNames.B,
      scoreA: score.A,
      scoreB: score.B,
      date: toUpperShortDate(baseDate),
      time: toTime(baseDate),
      status: formatStatus(data.match.status),
      location: formatVenueLabel(data.match.venue),
      isLastSegmentButt: !!lastSegment?.is_butt_game,
      periods: data.segments.map((seg) => formatSegmentLabel(seg.seg_no, seg.is_butt_game)),
      teamA: teamMembers.A.map(memberToPlayer),
      teamB: teamMembers.B.map(memberToPlayer),
      events: eventUi,
      payer: {
        payerTgId: payerInfo?.payer_tg_id ?? null,
        payerName:(payerInfo?.payer_tg_id
            ? data.members.find((member) => member.tg_id === payerInfo.payer_tg_id)?.name
            : null) || "НЕ ВЫБРАН",
        fio: payerInfo?.payer_fio || "вЂ”",
        phone: payerInfo?.payer_phone || "вЂ”",
        bank: payerInfo?.payer_bank || "вЂ”",
        amount: payerInfo?.payer_amount ?? null,
        perPerson: (() => {
          const amount = payerInfo?.payer_amount;
          if (amount == null) return null;
          const splitTargets = data.members.filter(
            (member) =>
              (member.role === "player" || member.role === "organizer")
          ).length;
          if (splitTargets <= 0) return null;
          return amount / splitTargets;
        })()
      }
    };
  }, [data, goalsAssists, mvpVotes, payerInfo, playerById, score, teamMembers, teamNames, worstVotes, paymentStatuses]);

  const mvpCountdown = useMemo(() => {
    const sourceTime = data?.match.finished_at || data?.match.created_at || null;
    if (!sourceTime) return null;
    const end = new Date(sourceTime).getTime() + 72 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = Math.max(0, end - now);
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return { hours, minutes, seconds };
  }, [data, timerTick]);

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

  const myTeamSelectable = useMemo(
    () => myTeam.filter((player) => player.tg_id !== myMember?.tg_id),
    [myTeam, myMember]
  );
  const allPlayersSelectable = useMemo(
    () => allMembers.filter((player) => player.tg_id !== myMember?.tg_id),
    [allMembers, myMember]
  );

  const comparisonPairs = useMemo(() => {
    return {
      cmp_own: pickPair(myTeamSelectable, seedBase + 0 * 13),
      cmp_opp: pickPair(oppTeam, seedBase + 1 * 13),
      cmp_cross: pickPair(allPlayersSelectable, seedBase + 2 * 13)
    };
  }, [allPlayersSelectable, myTeamSelectable, oppTeam, seedBase]);

  const feedbackPayload = useMemo(() => {
    const toNumber = (value: string | string[] | undefined) => {
      if (!value) return null;
      const raw = Array.isArray(value) ? value[0] : value;
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? null : parsed;
    };
    const pairToIds = (pair: readonly (MatchMember | null)[]) =>
      pair[0] && pair[1] ? [pair[0].tg_id, pair[1].tg_id] : [];
    const comparisonPairsPayload = {
      cmp_own: pairToIds(comparisonPairs.cmp_own),
      cmp_opp: pairToIds(comparisonPairs.cmp_opp),
      cmp_cross: pairToIds(comparisonPairs.cmp_cross)
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
        comparison_pairs: comparisonPairsPayload,
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
        best_attacker: toNumber(feedback.best_attacker),
        best_defender: toNumber(feedback.best_defender)
      }
    };
  }, [comparisonPairs, feedback]);

  const errorToast = error ? <StatusCard title={t("Ошибка")} message={error} onClose={() => setError(null)} /> : null;

  if (!matchUi) {
    return (
      <>
        <div className="text-sm text-muted-foreground px-4 py-6">{t("Загрузка...")}</div>
        {errorToast}
      </>
    );
  }

  const isPlayer = !!myMember && (myMember.role === "player" || myMember.role === "organizer");

  const handleSaveFeedback = async () => {
    if (!matchId) return;
    try {
      setFeedbackStatus("saving");
      await submitFeedback(Number(matchId), feedbackPayload);
      setFeedbackStatus("saved");
    } catch (err) {
      setFeedbackStatus("idle");
      setError(formatApiError(err));
    }
  };

  const refreshMatch = async () => {
    if (!matchId) return;
    const refreshed = await getMatch(Number(matchId));
    setData(refreshed);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-page)] max-w-md mx-auto border-x-2 border-[var(--border-main)] relative transition-colors duration-300">
      <div className="bg-[var(--bg-surface)] border-b-2 border-[var(--border-main)]">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="flex-1 px-4 pt-0 pb-6 overflow-x-hidden transition-colors duration-300">
        {activeTab === MatchTab.RESULT && (
          <ResultTab
            data={matchUi}
            matchId={matchId ? String(matchId) : ""}
            selfTgId={myMember?.tg_id ?? null}
            feedback={feedback}
            setFeedback={(next) => {
              setFeedback(next);
              setFeedbackStatus((prev) => (prev === "saving" ? prev : "idle"));
            }}
            feedbackStatus={feedbackStatus}
            onSaveFeedback={handleSaveFeedback}
            comparisonPairs={comparisonPairs}
            myTeamKey={myTeamKey}
            onRequestSelectPayer={() => setPayerSelectOpen(true)}
            onRequestConfirmPayments={() => setReportOpen(true)}
            isPlayer={isPlayer}
            isPayer={isPayer}
            isAdmin={isAdmin}
            isOrganizer={isOrganizer}
            myPaymentStatus={myPaymentStatus as PaymentStatusLabel}
            paymentStatuses={paymentStatuses}
            payerForm={payerForm}
            setPayerForm={setPayerForm}
            onSavePayer={async () => {
              if (!matchId) return;
              if (!/^\+7\d{10}$/.test(payerForm.phone)) {
                setError("Телефон должен быть в формате +79092811654");
                return;
              }
              try {
                await payerDetails(Number(matchId), {
                  payer_fio: payerForm.fio,
                  payer_phone: payerForm.phone,
                  payer_bank: payerForm.bank,
                  payer_amount: payerForm.amount.trim() === "" ? null : Number(payerForm.amount)
                });
                await refreshMatch();
              } catch (err) {
                setError(formatApiError(err));
              }
            }}
            onCopyPhone={(value) => navigator.clipboard.writeText(value)}
            onMarkPaid={async () => {
              if (!matchId) return;
              try {
                await markPaid(Number(matchId));
                await refreshMatch();
              } catch (err) {
                setError(formatApiError(err));
              }
            }}
            onRemindPayments={async () => {
              if (!matchId) return;
              try {
                await remindPayments(Number(matchId));
              } catch (err) {
                setError(formatApiError(err));
              }
            }}
          />
        )}
        {activeTab === MatchTab.EVENTS && <EventsTab data={matchUi} />}
        {activeTab === MatchTab.BEST && (
          <BestTab data={matchUi} mvpCountdown={mvpCountdown} />
        )}
      </main>

      {reportOpen && (
        <PaymentReportOverlay
          players={matchUi.teamA.concat(matchUi.teamB).filter((p) => p.tg_id !== payerInfo?.payer_tg_id)}
          statuses={paymentStatuses}
          isPayer={isPayer}
          isAdmin={isAdmin}
          isLoading={reportLoading}
          onClose={() => setReportOpen(false)}
          onDecision={async (tgId, approved) => {
            if (!matchId) return;
            try {
              setReportLoading(true);
              await confirmPayment(Number(matchId), { tg_id: tgId, approved });
              await refreshMatch();
            } catch (err) {
              setError(formatApiError(err));
            } finally {
              setReportLoading(false);
            }
          }}
        />
      )}

      {payerSelectOpen && (
        <PayerSelectOverlay
          players={matchUi.teamA.concat(matchUi.teamB)}
          onClose={() => setPayerSelectOpen(false)}
          onSelect={async (tgId) => {
            if (!matchId) return;
            try {
              await payerSelect(Number(matchId), tgId);
              setPayerSelectOpen(false);
              await refreshMatch();
            } catch (err) {
              setError(formatApiError(err));
            }
          }}
        />
      )}
      {errorToast}
    </div>
  );
}

const Tabs = ({ activeTab, onTabChange }: { activeTab: MatchTab; onTabChange: (tab: MatchTab) => void }) => {
  const tabs = [MatchTab.EVENTS, MatchTab.RESULT, MatchTab.BEST];
  const labelByTab: Record<MatchTab, string> = {
    [MatchTab.EVENTS]: "СОБЫТИЯ",
    [MatchTab.RESULT]: "ИТОГ",
    [MatchTab.BEST]: "ЛУЧШИЕ"
  };
  return (
    <div className="flex bg-[var(--bg-surface)] border-b-2 border-[var(--border-main)]">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-2.5 text-sm font-black italic tracking-tight transition-all
            ${activeTab === tab
              ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
              : "bg-[var(--bg-surface)] text-[var(--text-main)] opacity-50 active:opacity-100"}
          `}
        >
          {labelByTab[tab]}
        </button>
      ))}
    </div>
  );
};

const ResultTab = ({
  data,
  matchId,
  selfTgId,
  feedback,
  setFeedback,
  feedbackStatus,
  onSaveFeedback,
  comparisonPairs,
  myTeamKey,
  onRequestSelectPayer,
  onRequestConfirmPayments,
  isPlayer,
  isPayer,
  isAdmin,
  isOrganizer,
  myPaymentStatus,
  paymentStatuses,
  payerForm,
  setPayerForm,
  onSavePayer,
  onCopyPhone,
  onMarkPaid,
  onRemindPayments
}: {
  data: MatchDataUi;
  matchId: string;
  selfTgId: number | null;
  feedback: Record<string, string | string[]>;
  setFeedback: (next: Record<string, string | string[]>) => void;
  feedbackStatus: "idle" | "saving" | "saved";
  onSaveFeedback: () => void;
  comparisonPairs: { cmp_own: readonly (MatchMember | null)[]; cmp_opp: readonly (MatchMember | null)[]; cmp_cross: readonly (MatchMember | null)[] };
  myTeamKey: "A" | "B";
  onRequestSelectPayer: () => void;
  onRequestConfirmPayments: () => void;
  isPlayer: boolean;
  isPayer: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  myPaymentStatus: PaymentStatusLabel;
  paymentStatuses: { tg_id: number; status: string }[];
  payerForm: { fio: string; phone: string; bank: string; amount: string };
  setPayerForm: (next: { fio: string; phone: string; bank: string; amount: string }) => void;
  onSavePayer: () => void;
  onCopyPhone: (value: string) => void;
  onMarkPaid: () => void;
  onRemindPayments: () => void;
}) => {
  const [activePicker, setActivePicker] = useState<{
    type: "SINGLE" | "MULTI";
    target: string;
    limit?: number;
    teamFilter?: "A" | "B" | "ALL" | "MY" | "OPP";
  } | null>(null);
  const [isEditingPayer, setIsEditingPayer] = useState(false);
  const [copied, setCopied] = useState(false);
  const normalizePhoneInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    let digits = digitsOnly;
    if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    if (!digits.startsWith("7")) digits = `7${digits}`;
    digits = digits.slice(0, 11);
    return `+${digits}`;
  };
  const formatMoney = (value: number | null) => {
    if (value == null || Number.isNaN(value)) return "вЂ”";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  };

  const allPlayers = useMemo(
    () => [...data.teamA, ...data.teamB].filter((player) => player.tg_id !== selfTgId),
    [data, selfTgId]
  );
  const byId = useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);

  const getPlayer = (value?: string | string[]) => {
    if (!value) return null;
    const raw = Array.isArray(value) ? value[0] : value;
    return byId.get(String(raw)) || null;
  };

  const bestPlayer = getPlayer(feedback.best);
  const worstPlayer = getPlayer(feedback.worst);
  const synergyOwn = [getPlayer(feedback.syn_team_a), getPlayer(feedback.syn_team_b)].filter(Boolean) as Player[];
  const synergyOpp = [getPlayer(feedback.syn_opp_a), getPlayer(feedback.syn_opp_b)].filter(Boolean) as Player[];
  const dominationOwn = [getPlayer(feedback.dom_my), getPlayer(feedback.dom_opp_target)] as (Player | null)[];
  // For the second domination row, the right slot is the dominator.
  const dominationOpp = [getPlayer(feedback.dom_my_target), getPlayer(feedback.dom_opp)] as (Player | null)[];
  const bestAttacker = getPlayer(feedback.best_attacker);
  const bestDefender = getPlayer(feedback.best_defender);

  const handleCopy = () => {
    onCopyPhone(data.payer.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const duelPairs = [
    { key: "cmp_own", pair: comparisonPairs.cmp_own },
    { key: "cmp_opp", pair: comparisonPairs.cmp_opp },
    { key: "cmp_cross", pair: comparisonPairs.cmp_cross }
  ];
  const patchFeedback = (patch: Record<string, string>) => {
    setFeedback({ ...feedback, ...patch });
  };

  const handleDuelPick = (key: string, playerId: string) => {
    patchFeedback({ [key]: playerId });
  };

  const teamAIds = new Set(data.teamA.map((p) => p.id));
  const teamBIds = new Set(data.teamB.map((p) => p.id));
  const myTeamIds = myTeamKey === "A" ? teamAIds : teamBIds;
  const oppTeamIds = myTeamKey === "A" ? teamBIds : teamAIds;

  return (
    <div className="space-y-4 pb-4">
      <section className="mt-4 bg-[var(--bg-contrast)] rounded-[32px] p-4 text-[var(--text-contrast)] brutal-shadow">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 w-full">
          <div className="text-right flex flex-col items-end min-w-0">
            <div className="text-[9px] font-black italic opacity-40 uppercase tracking-widest leading-none mb-1">TEAM A</div>
            <div className="font-black italic text-base leading-tight uppercase line-clamp-2 w-full">{data.teamAName}</div>
          </div>
          <div className="mx-1 mt-2 shrink-0">
            <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-[20px] px-4 py-3 flex items-center justify-center gap-2 border-b-4 border-[var(--border-main)]/20">
              <span className="text-4xl font-black italic leading-none">{data.scoreA}</span>
              <span className="text-2xl font-black opacity-20 italic">:</span>
              <span className="text-4xl font-black italic leading-none">{data.scoreB}</span>
            </div>
          </div>
          <div className="text-left flex flex-col items-start min-w-0">
            <div className="text-[9px] font-black italic opacity-40 uppercase tracking-widest leading-none mb-1">TEAM B</div>
            <div className="font-black italic text-base leading-tight uppercase line-clamp-2 w-full">{data.teamBName}</div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          {data.isLastSegmentButt ? (
            <div className="px-3 py-1 rounded-full border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-[var(--text-main)] text-[10px] font-black uppercase tracking-wider">
              НА ЖОПУ
            </div>
          ) : (
            <div className="text-[10px] font-bold opacity-30 uppercase tracking-tight">{data.location}</div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-black italic uppercase opacity-40 whitespace-nowrap text-[var(--text-main)]">SQUAD LINEUPS</h2>
          <div className="h-[2px] bg-[var(--border-main)] opacity-10 flex-1" />
          <span className="text-xs font-black italic uppercase opacity-40 text-[var(--text-main)]">{data.teamA.length} VS {data.teamB.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div className="space-y-2">
            {data.teamA.map((player) => (
              <Link key={player.id} to={`/matches/${matchId}/players/${player.tg_id}`} className="block">
                <PlayerCard player={player} variant="black" />
              </Link>
            ))}
          </div>
          <div className="space-y-2">
            {data.teamB.map((player) => (
              <Link key={player.id} to={`/matches/${matchId}/players/${player.tg_id}`} className="block">
                <PlayerCard player={player} variant="white" />
              </Link>
            ))}
          </div>
        </div>
      </section>

            {isPlayer || isAdmin ? (
        <section className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 brutal-shadow space-y-4 rounded-[32px] transition-colors">
          <h2 className="text-base font-black italic uppercase leading-none text-[var(--text-main)]">ПЛАТЕЖИ</h2>
          <div className="bg-[var(--bg-page)]/50 p-3 border-2 border-[var(--border-main)] rounded-2xl relative">
            {isEditingPayer ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={payerForm.fio}
                  onChange={(e) => setPayerForm({ ...payerForm, fio: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]"
                  placeholder="ФИО"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={payerForm.phone}
                  onChange={(e) => setPayerForm({ ...payerForm, phone: normalizePhoneInput(e.target.value) })}
                  className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]"
                  placeholder="ТЕЛЕФОН"
                />
                <input
                  type="text"
                  value={payerForm.bank}
                  onChange={(e) => setPayerForm({ ...payerForm, bank: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]"
                  placeholder="БАНК"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={payerForm.amount}
                    onChange={(e) => setPayerForm({ ...payerForm, amount: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]"
                    placeholder="ОПЛАЧЕНО ЗА ПОЛЕ"
                  />
                  <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 rounded-lg">
                    <div className="text-[8px] font-bold uppercase opacity-50">С ЧЕЛОВЕКА</div>
                    <div className="font-black text-xs italic leading-none mt-0.5">
                      {formatMoney(
                        payerForm.amount.trim() === ""
                          ? null
                          : Number(payerForm.amount) /
                              Math.max(1, data.teamA.concat(data.teamB).length)
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditingPayer(false);
                    onSavePayer();
                  }}
                  className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-2 font-black italic text-[9px] uppercase rounded-lg"
                >
                  СОХРАНИТЬ
                </button>
              </div>
            ) : (
              <>
                <div className="text-[9px] font-bold uppercase opacity-50 text-[var(--text-main)]">ПЛАТЕЛЬЩИК: {data.payer.payerName}</div>
                <div className="text-[9px] font-bold uppercase opacity-50 mt-1 text-[var(--text-main)]">ФИО: {data.payer.fio}</div>
                <div className="font-black text-xs italic mt-0.5 text-[var(--text-main)]">{data.payer.phone} ({data.payer.bank})</div>
                {isPayer ? (
                  <div className="mt-1 text-[9px] font-bold uppercase opacity-60 text-[var(--text-main)]">
                    ОПЛАЧЕНО: {formatMoney(data.payer.amount)} • С ЧЕЛОВЕКА: {formatMoney(data.payer.perPerson)}
                  </div>
                ) : (
                  <div className="mt-1 text-[9px] font-bold uppercase opacity-60 text-[var(--text-main)]">
                    С ЧЕЛОВЕКА: {formatMoney(data.payer.perPerson)}
                  </div>
                )}
                {isPayer ? (
                  <button
                    onClick={() => setIsEditingPayer(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 border-2 border-[var(--border-main)] px-3 py-1.5 font-black italic text-[8px] uppercase bg-[var(--bg-surface)] text-[var(--text-main)] active:scale-90 brutal-shadow-sm transition-all"
                  >
                    ИЗМЕНИТЬ
                  </button>
                ) : (
                  <button
                    onClick={handleCopy}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 border-2 border-[var(--border-main)] px-3 py-1.5 font-black italic text-[8px] uppercase transition-all ${
                      copied
                        ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-main)] active:scale-90 brutal-shadow-sm"
                    }`}
                  >
                    {copied ? "СКОПИРОВАНО" : "КОПИРОВАТЬ"}
                  </button>
                )}
              </>
            )}
          </div>

          {(isPlayer || isOrganizer) && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                {isPayer ? (
                  <>
                    <div className="text-[9px] font-bold uppercase opacity-50 text-[var(--text-main)]">ОПЛАТИЛИ</div>
                    <div className="font-black italic uppercase text-xs text-[var(--text-main)]">
                      {paymentStatuses.filter((s) => s.status === "confirmed").length} ИЗ{" "}
                      {Math.max(
                        0,
                        data.teamA.concat(data.teamB).length -
                          (data.payer?.payerTgId ? 1 : 0)
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[9px] font-bold uppercase opacity-50 text-[var(--text-main)]">ВАШ СТАТУС</div>
                    <div
                      className={`font-black italic uppercase text-xs text-[var(--text-main)] ${
                        myPaymentStatus === "confirmed"
                          ? ""
                          : myPaymentStatus === "rejected"
                            ? "opacity-70"
                            : "opacity-60"
                      }`}
                    >
                      {paymentStatusLabel(myPaymentStatus)}
                    </div>
                  </>
                )}
              </div>
              {!isPayer ? (
                <button
                  onClick={onMarkPaid}
                  className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic px-5 py-3 border-2 border-[var(--border-main)] brutal-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[10px] uppercase rounded-xl"
                >
                  ОТПРАВИЛ
                </button>
              ) : null}
            </div>
          )}

          {(isPayer || isAdmin) && (
            <div className="space-y-2 pt-1">
              <button
                onClick={onRequestConfirmPayments}
                className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic px-5 py-3 border-2 border-[var(--border-main)] brutal-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[10px] uppercase rounded-xl"
              >
                ПОДТВЕРДИТЬ ОПЛАТЫ
              </button>
            </div>
          )}

          {isPayer && (
            <div className="space-y-2 pt-1">
              <button
                onClick={onRemindPayments}
                className="w-full border-2 border-[var(--border-main)] bg-[var(--bg-surface)] font-black italic px-5 py-3 brutal-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[10px] uppercase rounded-xl"
              >
                НАПОМНИТЬ ОБ ОПЛАТЕ
              </button>
            </div>
          )}

          {isOrganizer && (
            <div className="space-y-2 pt-1">
              <button
                onClick={onRequestSelectPayer}
                className="w-full border-2 border-[var(--border-main)] bg-[var(--bg-surface)] font-black italic px-5 py-3 brutal-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[10px] uppercase rounded-xl"
              >
                ВЫБРАТЬ ПЛАТЕЛЬЩИКА
              </button>
            </div>
          )}

          {/* список оплат показываем только в модалке подтверждения */}
        </section>
      ) : null}

      {isPlayer ? (
        <section className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 brutal-shadow space-y-8 rounded-[32px] transition-colors">
          <h2 className="text-2xl font-black italic uppercase border-b-4 border-[var(--border-main)] pb-3 text-[var(--text-main)]">
            ОЦЕНКА МАТЧА
          </h2>

        <div className="grid grid-cols-2 gap-4">
          <FeedbackSlot
            label="MVP (ЛУЧШИЙ)"
            player={bestPlayer}
            onClick={() => setActivePicker({ type: "SINGLE", target: "BEST", teamFilter: "ALL" })}
          />
          <FeedbackSlot
            label="LVP (ХУДШИЙ)"
            player={worstPlayer}
            onClick={() => setActivePicker({ type: "SINGLE", target: "WORST", teamFilter: "ALL" })}
            color="bg-[var(--bg-page)]/50"
          />
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">
            ДУЭЛИ МАТЧА
          </div>
          <div className="space-y-2">
            {duelPairs.map((duel) => {
              const left = duel.pair[0] ? data.teamA.concat(data.teamB).find((p) => p.tg_id === duel.pair[0]?.tg_id) : null;
              const right = duel.pair[1] ? data.teamA.concat(data.teamB).find((p) => p.tg_id === duel.pair[1]?.tg_id) : null;
              if (!left || !right) return null;
              const selected = feedback[duel.key] ? String(feedback[duel.key]) : null;
              return (
                <div
                  key={duel.key}
                  className="flex items-center justify-between border-2 border-[var(--border-main)] rounded-2xl p-2 bg-[var(--bg-page)]/50"
                >
                  <DuelPlayer
                    player={left}
                    isSelected={selected === left.id}
                    onClick={() => handleDuelPick(duel.key, left.id)}
                  />
                  <div className="font-black italic text-xs opacity-20 px-2 text-[var(--text-main)]">VS</div>
                  <DuelPlayer
                    player={right}
                    isSelected={selected === right.id}
                    onClick={() => handleDuelPick(duel.key, right.id)}
                    isRight
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">
            ЛУЧШАЯ СВЯЗКА (ВЫБРАТЬ 2)
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SynergyBlock
              label="OUR TEAM"
              players={synergyOwn}
              onClick={() => setActivePicker({ type: "MULTI", target: "SYNERGY_OWN", limit: 2, teamFilter: "MY" })}
            />
            <SynergyBlock
              label="OPPONENTS"
              players={synergyOpp}
              onClick={() => setActivePicker({ type: "MULTI", target: "SYNERGY_OPP", limit: 2, teamFilter: "OPP" })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">
            ПАРЫ ДОМИНАЦИИ
          </div>
          <div className="space-y-4">
            <DominationRow
              title="HE DOMINATED"
              p1={dominationOwn[0]}
              p2={dominationOwn[1]}
              onP1={() => setActivePicker({ type: "SINGLE", target: "DOM_OWN_1", teamFilter: "MY" })}
              onP2={() => setActivePicker({ type: "SINGLE", target: "DOM_OWN_2", teamFilter: "OPP" })}
            />
            <DominationRow
              title="HE WAS STRONGER"
              p1={dominationOpp[0]}
              p2={dominationOpp[1]}
              onP1={() => setActivePicker({ type: "SINGLE", target: "DOM_OPP_2", teamFilter: "MY" })}
              onP2={() => setActivePicker({ type: "SINGLE", target: "DOM_OPP_1", teamFilter: "OPP" })}
              reverse
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FeedbackSlot
            label="ЛУЧШИЙ АТАКУЮЩИЙ"
            player={bestAttacker}
            onClick={() => setActivePicker({ type: "SINGLE", target: "ATTACKER", teamFilter: "ALL" })}
          />
          <FeedbackSlot
            label="ЛУЧШИЙ ЗАЩИТНИК"
            player={bestDefender}
            onClick={() => setActivePicker({ type: "SINGLE", target: "DEFENDER", teamFilter: "ALL" })}
          />
        </div>

        <button
          onClick={onSaveFeedback}
          className={`w-full py-5 font-black italic uppercase border-4 border-[var(--border-main)] brutal-shadow transition-all text-sm rounded-2xl ${
            feedbackStatus === "saved"
              ? "bg-[var(--bg-surface)] text-[var(--text-main)]"
              : "bg-[var(--bg-contrast)] text-[var(--text-contrast)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          }`}
          disabled={feedbackStatus === "saving"}
        >
          {feedbackStatus === "saved" ? "СОХРАНЕНО" : feedbackStatus === "saving" ? "ПРИМЕНЯЮ..." : "ПРИМЕНИТЬ ИЗМЕНЕНИЯ"}
        </button>
        </section>
      ) : null}

      {activePicker && (
        <PlayerPickerOverlay
          config={activePicker}
          players={allPlayers}
          onClose={() => setActivePicker(null)}
          onConfirm={(selected) => {
            if (activePicker.target === "BEST") patchFeedback({ best: selected[0]?.id || "" });
            if (activePicker.target === "WORST") patchFeedback({ worst: selected[0]?.id || "" });
            if (activePicker.target === "SYNERGY_OWN") {
              patchFeedback({
                syn_team_a: selected[0]?.id || "",
                syn_team_b: selected[1]?.id || ""
              });
            }
            if (activePicker.target === "SYNERGY_OPP") {
              patchFeedback({
                syn_opp_a: selected[0]?.id || "",
                syn_opp_b: selected[1]?.id || ""
              });
            }
            if (activePicker.target === "DOM_OWN_1") patchFeedback({ dom_my: selected[0]?.id || "" });
            if (activePicker.target === "DOM_OWN_2") patchFeedback({ dom_opp_target: selected[0]?.id || "" });
            if (activePicker.target === "DOM_OPP_1") patchFeedback({ dom_opp: selected[0]?.id || "" });
            if (activePicker.target === "DOM_OPP_2") patchFeedback({ dom_my_target: selected[0]?.id || "" });
            if (activePicker.target === "ATTACKER") patchFeedback({ best_attacker: selected[0]?.id || "" });
            if (activePicker.target === "DEFENDER") patchFeedback({ best_defender: selected[0]?.id || "" });
            setActivePicker(null);
          }}
          teamAIds={teamAIds}
          teamBIds={teamBIds}
          myTeamIds={myTeamIds}
          oppTeamIds={oppTeamIds}
        />
      )}
    </div>
  );
};

const PlayerCard = ({ player, variant }: { player: Player; variant: "black" | "white" }) => {
  const isBlack = variant === "black";
  const avatarUrl = player.avatar ? resolveMediaUrl(player.avatar) : "";

  return (
    <div
      className={`flex items-center p-2 border-2 border-[var(--border-main)] transition-all active:scale-95 cursor-pointer rounded-2xl ${
        isBlack ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]" : "bg-[var(--bg-surface)] text-[var(--text-main)]"
      }`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={player.name} className="w-10 h-10 border-2 border-current grayscale rounded-sm object-cover" />
      ) : (
        <div className="w-10 h-10 border-2 border-current rounded-sm flex items-center justify-center font-black text-xs">
          {getInitials(player.name)}
        </div>
      )}
      <div className="ml-2 flex-1 min-w-0">
        <div className="font-black italic text-[13px] truncate leading-none uppercase">{player.name}</div>
      </div>
      <div className="flex flex-col gap-1 ml-1">
        <div
          className={`px-1.5 py-0.5 border-2 border-current font-black italic text-[8px] uppercase leading-none text-center min-w-[32px] rounded-lg ${
            isBlack ? "bg-[var(--bg-surface)] text-[var(--text-main)]" : "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
          }`}
        >
          {player.goals}G
        </div>
        <div
          className={`px-1.5 py-0.5 border-2 border-current font-black italic text-[8px] uppercase leading-none text-center min-w-[32px] rounded-lg ${
            isBlack ? "bg-[var(--bg-surface)] text-[var(--text-main)]" : "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
          }`}
        >
          {player.assists}A
        </div>
      </div>
    </div>
  );
};

const FeedbackSlot = ({ label, player, onClick, color = "bg-[var(--bg-page)]/50" }: { label: string; player: Player | null; onClick: () => void; color?: string }) => {
  const avatarUrl = player?.avatar ? resolveMediaUrl(player.avatar) : "";
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-black italic uppercase opacity-40 tracking-wider text-[var(--text-main)]">{label}</div>
      <button
        onClick={onClick}
        className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center p-2 brutal-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ${
          player
            ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-4 border-[var(--text-contrast)]"
            : `border-2 border-[var(--border-main)] ${color}`
        }`}
      >
        {player ? (
          <>
            {avatarUrl ? (
              <img src={avatarUrl} className="w-14 h-14 border-2 border-[var(--text-contrast)] rounded-sm mb-1 grayscale object-cover" />
            ) : (
              <div className="w-14 h-14 border-2 border-[var(--text-contrast)] rounded-sm mb-1 flex items-center justify-center font-black text-xs">
                {getInitials(player.name)}
              </div>
            )}
            <span className="font-black italic text-[10px] uppercase truncate w-full">{player.name}</span>
          </>
        ) : (
          <div className="flex flex-col items-center opacity-30 text-[var(--text-main)]">
            <div className="text-xl font-black">+</div>
            <div className="text-[8px] font-black italic uppercase">PICK</div>
          </div>
        )}
      </button>
    </div>
  );
};

const DuelPlayer = ({ player, isSelected, onClick, isRight }: { player: Player; isSelected: boolean; onClick: () => void; isRight?: boolean }) => {
  const avatarUrl = player.avatar ? resolveMediaUrl(player.avatar) : "";
  const avatarBorderClass = isSelected ? "border-[var(--text-contrast)]" : "border-[var(--border-main)]";
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center gap-2 p-1.5 rounded-xl transition-all ${
        isSelected
          ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-4 border-[var(--text-contrast)]"
          : "bg-[var(--bg-surface)] border-2 border-transparent text-[var(--text-main)]"
      } ${isRight ? "flex-row-reverse text-right" : ""}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} className={`w-8 h-8 rounded-sm border-2 ${avatarBorderClass} grayscale object-cover`} />
      ) : (
        <div className={`w-8 h-8 rounded-sm border-2 ${avatarBorderClass} flex items-center justify-center font-black text-[9px]`}>
          {getInitials(player.name)}
        </div>
      )}
      <span className="font-black italic text-[10px] uppercase truncate">{player.name}</span>
    </button>
  );
};

const SynergyBlock = ({ label, players, onClick }: { label: string; players: Player[]; onClick: () => void }) => (
  <div className="space-y-2">
    <div className="text-[9px] font-black italic uppercase opacity-40 tracking-wider text-[var(--text-main)]">{label}</div>
    <button onClick={onClick} className="w-full border-2 border-[var(--border-main)] rounded-2xl p-2 bg-[var(--bg-page)]/50 brutal-shadow-sm flex items-center justify-center gap-1 min-h-[60px]">
      {players.length > 0 ? (
        <div className="flex -space-x-4">
          {players.map((p) => {
            const avatarUrl = p.avatar ? resolveMediaUrl(p.avatar) : "";
            return avatarUrl ? (
              <img key={p.id} src={avatarUrl} className="w-10 h-10 border-2 border-current rounded-sm grayscale bg-[var(--bg-surface)] object-cover" />
            ) : (
              <div key={p.id} className="w-10 h-10 border-2 border-current rounded-sm grayscale bg-[var(--bg-surface)] flex items-center justify-center font-black text-[9px]">
                {getInitials(p.name)}
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-[9px] font-black italic opacity-30 uppercase text-[var(--text-main)]">SELECT 2</span>
      )}
    </button>
  </div>
);

const DominationRow = ({
  title,
  p1,
  p2,
  onP1,
  onP2,
  reverse
}: {
  title: string;
  p1: Player | null;
  p2: Player | null;
  onP1: () => void;
  onP2: () => void;
  reverse?: boolean;
}) => (
  <div className="space-y-2">
    <div className="text-[9px] font-black italic uppercase opacity-40 text-center tracking-widest text-[var(--text-main)]">{title}</div>
    <div className="flex items-center gap-4">
      <DomMiniSlot player={p1} onClick={onP1} />
      <div className="text-xl font-black italic opacity-20 text-[var(--text-main)]">{reverse ? "<" : ">"}</div>
      <DomMiniSlot player={p2} onClick={onP2} />
    </div>
  </div>
);

const DomMiniSlot = ({ player, onClick }: { player: Player | null; onClick: () => void }) => {
  const avatarUrl = player?.avatar ? resolveMediaUrl(player.avatar) : "";
  const avatarBorderClass = player ? "border-[var(--text-contrast)]" : "border-[var(--border-main)]";
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center gap-3 p-2 rounded-2xl transition-all brutal-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
        player
          ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-4 border-[var(--text-contrast)]"
          : "bg-[var(--bg-surface)] text-[var(--text-main)] border-2 border-[var(--border-main)]"
      }`}
    >
      {player ? (
        <>
          {avatarUrl ? (
            <img src={avatarUrl} className={`w-8 h-8 rounded-sm border-2 ${avatarBorderClass} grayscale object-cover`} />
          ) : (
            <div className={`w-8 h-8 rounded-sm border-2 ${avatarBorderClass} flex items-center justify-center font-black text-[9px]`}>
              {getInitials(player.name)}
            </div>
          )}
          <span className="font-black italic text-[10px] uppercase truncate">{player.name}</span>
        </>
      ) : (
        <span className="w-full text-center text-[9px] font-black opacity-30 italic">PICK</span>
      )}
    </button>
  );
};

const PlayerPickerOverlay = ({
  config,
  players,
  onClose,
  onConfirm,
  teamAIds,
  teamBIds,
  myTeamIds,
  oppTeamIds
}: {
  config: { type: "SINGLE" | "MULTI"; target: string; limit?: number; teamFilter?: "A" | "B" | "ALL" | "MY" | "OPP" };
  players: Player[];
  onClose: () => void;
  onConfirm: (selected: Player[]) => void;
  teamAIds: Set<string>;
  teamBIds: Set<string>;
  myTeamIds: Set<string>;
  oppTeamIds: Set<string>;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredPlayers = players.filter((p) => {
    if (config.teamFilter === "A") return teamAIds.has(p.id);
    if (config.teamFilter === "B") return teamBIds.has(p.id);
    if (config.teamFilter === "MY") return myTeamIds.has(p.id);
    if (config.teamFilter === "OPP") return oppTeamIds.has(p.id);
    return true;
  });

  const handleSelect = (p: Player) => {
    if (config.type === "SINGLE") {
      onConfirm([p]);
    } else {
      if (selectedIds.includes(p.id)) {
        setSelectedIds(selectedIds.filter((id) => id !== p.id));
      } else if (selectedIds.length < (config.limit || 1)) {
        setSelectedIds([...selectedIds, p.id]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-contrast)]/80 flex items-end animate-in fade-in">
      <div className="w-full bg-[var(--bg-surface)] border-t-4 border-[var(--border-main)] rounded-t-[40px] p-6 max-h-[85vh] overflow-y-auto brutal-shadow animate-in slide-in-from-bottom-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black italic uppercase text-[var(--text-main)]">ВЫБРАТЬ ИГРОКА</h3>
          <button onClick={onClose} className="w-10 h-10 border-2 border-[var(--border-main)] flex items-center justify-center font-black rounded-full text-[var(--text-main)]">
            X
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-8">
          {filteredPlayers.map((p) => {
            const avatarUrl = p.avatar ? resolveMediaUrl(p.avatar) : "";
            const isSelected = selectedIds.includes(p.id);
            const avatarBorderClass = isSelected ? "border-[var(--text-contrast)]" : "border-[var(--border-main)]";
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`flex items-center p-2 rounded-xl transition-all gap-3 ${
                  isSelected
                    ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-4 border-[var(--text-contrast)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-main)] border-2 border-[var(--border-main)] active:bg-[var(--bg-page)]/60"
                }`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} className={`w-10 h-10 rounded-sm grayscale border-2 ${avatarBorderClass}`} />
                ) : (
                  <div className={`w-10 h-10 rounded-sm grayscale border-2 ${avatarBorderClass} flex items-center justify-center font-black text-[9px]`}>
                    {getInitials(p.name)}
                  </div>
                )}
                <span className="font-black italic text-[11px] uppercase truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
        {config.type === "MULTI" && (
          <button
            disabled={selectedIds.length !== config.limit}
            onClick={() => onConfirm(selectedIds.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[])}
            className="w-full py-4 bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic uppercase rounded-2xl disabled:opacity-20 transition-all border-2 border-[var(--border-main)] brutal-shadow-sm"
          >
            ПОДТВЕРДИТЬ ВЫБОР ({selectedIds.length}/{config.limit})
          </button>
        )}
      </div>
    </div>
  );
};

const EventsTab = ({ data }: { data: MatchDataUi }) => {
  const { matchId } = useParams();
  const groupedEvents = data.periods.map((period) => ({
    period,
    events: data.events.filter((e) => e.period === period)
  }));

  const allPlayers = [...data.teamA, ...data.teamB];
  const getPlayer = (name: string) => allPlayers.find((p) => p.name === name);

  return (
    <div className="space-y-12 pb-20">
      {groupedEvents.map((group) => (
        <div key={group.period} className="space-y-4">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-xl font-black italic uppercase tracking-tighter">{group.period}</h2>
            <div className="h-[4px] bg-[var(--border-main)] flex-1 rounded-full" />
          </div>

          <div className="space-y-4">
            {group.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                scorer={getPlayer(event.player)}
                assistant={event.assist ? getPlayer(event.assist) : undefined}
                teamAName={data.teamAName}
                teamBName={data.teamBName}
                matchId={matchId}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-12 p-8 border-4 border-[var(--border-main)] border-dashed rounded-[40px] flex flex-col items-center justify-center opacity-30 text-[var(--text-main)]">
        <div className="text-4xl font-black italic uppercase tracking-tighter">FULL TIME</div>
        <div className="text-sm font-bold uppercase">NO MORE EVENTS</div>
      </div>
    </div>
  );
};

const EventCard = ({ event, scorer, assistant, teamAName, teamBName, matchId }: {
  event: MatchEventUi;
  scorer?: Player;
  assistant?: Player;
  teamAName: string;
  teamBName: string;
  matchId?: string;
}) => {
  const isTeamA = event.team === "A";
  const hasAssist = !!event.assist;
  const scorerAvatar = scorer?.avatar ? resolveMediaUrl(scorer.avatar) : "";
  const assistAvatar = assistant?.avatar ? resolveMediaUrl(assistant.avatar) : "";

  return (
    <div
      className={`relative w-full border-4 border-[var(--border-main)] rounded-[32px] p-5 brutal-shadow overflow-hidden ${
        isTeamA ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]" : "bg-[var(--bg-surface)] text-[var(--text-main)]"
      }`}
    >
      <div className="absolute top-2 right-4 text-[40px] font-black italic opacity-10 pointer-events-none uppercase leading-none">
        {isTeamA ? teamAName : teamBName}
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <div
              className={`absolute top-0 left-0 border-4 border-[var(--text-main)] rounded-2xl overflow-hidden grayscale bg-[var(--bg-surface)] transition-all ${
                hasAssist ? "w-16 h-16" : "w-20 h-20"
              }`}
            >
              {scorerAvatar ? (
                <img src={scorerAvatar} className="w-full h-full object-cover" alt={event.player} />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-sm text-[var(--text-main)]">
                  {getInitials(event.player)}
                </div>
              )}
            </div>
            {hasAssist && assistant && (
              <div className="absolute -bottom-1 -right-1 w-10 h-10 border-4 border-[var(--text-main)] rounded-xl overflow-hidden grayscale bg-[var(--bg-surface)]">
                {assistAvatar ? (
                  <img src={assistAvatar} className="w-full h-full object-cover" alt={event.assist} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-[9px] text-[var(--text-main)]">
                    {getInitials(event.assist || "")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[9px] font-black italic uppercase rounded-md border-2 border-current">
                {event.type === "goal" ? "GOAL" : "OWN GOAL"}
              </span>
            </div>
            <h3 className="text-2xl font-black italic uppercase leading-none tracking-tighter">
              {scorer && matchId ? <Link to={`/matches/${matchId}/players/${scorer.tg_id}`}>{event.player}</Link> : event.player}
            </h3>
            {event.assist && (
              <div className="text-[10px] font-sans font-bold uppercase opacity-60 not-italic mt-1">
                ASSIST BY {assistant && matchId ? <Link to={`/matches/${matchId}/players/${assistant.tg_id}`}>{event.assist}</Link> : event.assist}
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-black italic tracking-tighter border-b-4 border-current pb-1">
            {event.scoreAfter.replace(/\s/g, "")}
          </div>
          <div className="text-[10px] font-black italic opacity-40 uppercase mt-1">RESULT</div>
        </div>
      </div>
    </div>
  );
};

const BestTab = ({ data, mvpCountdown }: { data: MatchDataUi; mvpCountdown: { hours: number; minutes: number; seconds: number } | null }) => {
  const { matchId } = useParams();
  const [filter, setFilter] = useState<"ALL" | "A" | "B">("ALL");
  const playerScores = useMemo<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const all = [...data.teamA, ...data.teamB];
    all.forEach((p) => {
      initial[p.id] = p.mvpVotes;
    });
    return initial;
  }, [data]);

  const allPlayersWithScores = useMemo(() => {
    return [...data.teamA, ...data.teamB].map((p) => ({
      ...p,
      currentScore: playerScores[p.id] || 0
    }));
  }, [data, playerScores]);

  const contenders = useMemo(() => {
    return [...allPlayersWithScores]
      .sort((a, b) => b.currentScore - a.currentScore)
      .filter((p) => p.currentScore !== 0)
      .slice(0, 5);
  }, [allPlayersWithScores]);

  const leaderId = contenders.length > 0 && contenders[0].currentScore > 0 ? contenders[0].id : null;
  const maxVisualRange = 4;

  const visualMapping = useMemo(() => {
    const mapping: Record<string, number> = {};
    const posContenders = contenders.filter((p) => p.currentScore > 0);
    const uniquePos = Array.from<number>(new Set(posContenders.map((p) => p.currentScore))).sort((a, b) => b - a);
    uniquePos.forEach((score, rank) => {
      const vStep = Math.max(1, Math.min(score, maxVisualRange - rank));
      posContenders.filter((p) => p.currentScore === score).forEach((p) => {
        mapping[p.id] = vStep;
      });
    });

    const negContenders = contenders.filter((p) => p.currentScore < 0);
    const uniqueNeg = Array.from<number>(new Set(negContenders.map((p) => p.currentScore))).sort((a, b) => a - b);
    uniqueNeg.forEach((score, rank) => {
      const vStep = Math.min(-1, Math.max(score, -maxVisualRange + rank));
      negContenders.filter((p) => p.currentScore === score).forEach((p) => {
        mapping[p.id] = vStep;
      });
    });

    return mapping;
  }, [contenders]);

  const stepsData = useMemo(() => {
    const steps: Record<number, { players: typeof contenders; score: number }> = {};
    steps[0] = { players: [], score: 0 };
    contenders.forEach((p) => {
      const vStep = visualMapping[p.id];
      if (vStep === undefined) return;
      if (!steps[vStep]) {
        steps[vStep] = { players: [], score: p.currentScore };
      }
      steps[vStep].players.push(p);
    });
    return steps;
  }, [visualMapping, contenders]);

  const maxStackDepth = useMemo(() => {
    return Math.max(0, ...Object.values(stepsData).map((s) => s.players.length));
  }, [stepsData]);

  const containerPaddingBottom = useMemo(() => {
    if (maxStackDepth >= 3) return "pb-44";
    if (maxStackDepth >= 2) return "pb-32";
    return "pb-24";
  }, [maxStackDepth]);

  const getLeftPos = (step: number) => ((step + maxVisualRange) / (maxVisualRange * 2)) * 100;

  const filteredPlayers = filter === "ALL" ? allPlayersWithScores : filter === "A" ? allPlayersWithScores.filter((p) => data.teamA.some((tp) => tp.id === p.id)) : allPlayersWithScores.filter((p) => data.teamB.some((tp) => tp.id === p.id));

  const topStats = {
    combined: [...filteredPlayers]
      .sort((a, b) => {
        const totalDiff = b.goals + b.assists - (a.goals + a.assists);
        if (totalDiff !== 0) return totalDiff;
        const goalsDiff = b.goals - a.goals;
        if (goalsDiff !== 0) return goalsDiff;
        const assistsDiff = b.assists - a.assists;
        if (assistsDiff !== 0) return assistsDiff;
        return a.name.localeCompare(b.name, "ru");
      })
      .slice(0, 3),
    goals: [...filteredPlayers].sort((a, b) => b.goals - a.goals).slice(0, 3),
    assists: [...filteredPlayers].sort((a, b) => b.assists - a.assists).slice(0, 3)
  };

  return (
    <div className="space-y-6 pb-24 text-[var(--text-main)]">
      <section className="space-y-0">
        <div className="text-center space-y-1 mb-2">
          <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter">MVP RACE</h2>
          <div className="flex flex-col items-center">
            <div className="font-black italic text-[14px] uppercase tracking-tight opacity-80 tabular-nums">
              ДО КОНЦА ОСТАЛОСЬ {mvpCountdown?.hours ?? 0} Ч. {mvpCountdown?.minutes ?? 0} М.
            </div>
          </div>
        </div>

        <div className={`relative px-4 pt-24 ${containerPaddingBottom} min-h-[160px] flex flex-col justify-center transition-all duration-500 ease-in-out`}>
          <div className="relative mx-10 h-0.5">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-[var(--border-main)] -translate-y-1/2 rounded-full opacity-60" />

            {Object.entries(stepsData).map(([stepStr, step]) => {
              const stepIdx = Number(stepStr);
              const isZero = stepIdx === 0;
              return (
                <div key={`vstep-${stepIdx}`} className="absolute top-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${getLeftPos(stepIdx)}%` }}>
                  <div className="flex flex-col items-center pointer-events-none">
                    <div className={`transition-all duration-500 rounded-full ${isZero ? "bg-[var(--border-main)] w-1.5 h-12" : "bg-[var(--border-main)] w-1 h-6 opacity-80"}`} />
                    <div className={`absolute -bottom-10 px-1.5 py-0.5 rounded-lg font-black italic text-[10px] leading-none border-2 ${isZero ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-[var(--border-main)]" : "bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-main)] shadow-sm"}`}>
                      {step.score > 0 ? `+${step.score}` : step.score}
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {step.players.map((p, idx) => {
                      const isLeader = p.id === leaderId;
                      const yOffset = idx === 0 ? -64 : idx === 1 ? 64 : 116;
                      const avatarUrl = p.avatar ? resolveMediaUrl(p.avatar) : "";
                      return (
                        <div key={p.id} className="absolute transition-all duration-700" style={{ transform: `translate(-50%, ${yOffset}px)`, zIndex: isLeader ? 30 : 20 }}>
                          <div className="relative">
                            {isLeader && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[var(--text-main)] drop-shadow-[0_2px_0_var(--border-main)] scale-110">
                                {CROWN_SVG}
                              </div>
                            )}
                            <Link
                              to={`/matches/${matchId}/players/${p.tg_id}`}
                              className={`block w-11 h-11 border-2 border-[var(--border-main)] rounded-2xl overflow-hidden grayscale bg-[var(--bg-surface)] brutal-shadow-sm transition-transform ${
                                isLeader ? "scale-110 ring-4 ring-[var(--border-main)]/30" : ""
                              }`}
                            >
                              {avatarUrl ? (
                                <img src={avatarUrl} className="w-full h-full object-cover" alt={p.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-black text-[14px] text-[var(--bg-contrast)]">
                                  {getInitials(p.name)}
                                </div>
                              )}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-4">
        <div className="flex border-4 border-[var(--border-main)] rounded-3xl overflow-hidden mx-1 brutal-shadow bg-[var(--bg-surface)]">
          {(["ALL", "A", "B"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-5 font-black italic text-[14px] uppercase transition-colors ${
                filter === f
                  ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-main)] active:bg-[var(--bg-page)]/60"
              }`}
            >
              {f === "ALL" ? "OVERALL" : f === "A" ? data.teamAName : data.teamBName}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6 px-1 pb-4">
          <PodiumBlock title="GOAL + ASSIST" players={topStats.combined} getVal={(p) => p.goals + p.assists} matchId={matchId} />
          <PodiumBlock title="GOALS" players={topStats.goals} getVal={(p) => p.goals} matchId={matchId} />
          <PodiumBlock title="ASSISTS" players={topStats.assists} getVal={(p) => p.assists} matchId={matchId} />
        </div>
      </section>

    </div>
  );
};

const PodiumBlock = ({ title, players, getVal, matchId }: { title: string; players: Player[]; getVal: (p: Player) => number; matchId?: string }) => {
  const podiumOrder = useMemo(() => {
    const order: Array<{ p: Player; rank: number }> = [];
    if (players[1]) order.push({ p: players[1], rank: 2 });
    if (players[0]) order.push({ p: players[0], rank: 1 });
    if (players[2]) order.push({ p: players[2], rank: 3 });
    return order;
  }, [players]);

  return (
    <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] rounded-[40px] brutal-shadow p-6 flex flex-col items-center">
      <div className="text-[11px] font-black opacity-40 uppercase mb-8 tracking-widest text-center">{title}</div>

      <div className="flex items-end justify-center w-full gap-2 mt-auto">
        {podiumOrder.map(({ p, rank }) => {
          const isFirst = rank === 1;
          const isSecond = rank === 2;
          const height = isFirst ? "h-40" : isSecond ? "h-32" : "h-24";
          const avatarSize = isFirst ? "w-16 h-16" : "w-14 h-14";
          const avatarUrl = p.avatar ? resolveMediaUrl(p.avatar) : "";

          return (
            <div key={p.id} className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <Link to={matchId ? `/matches/${matchId}/players/${p.tg_id}` : "#"} className="block">
                  {avatarUrl ? (
                    <img src={avatarUrl} className={`${avatarSize} border-2 border-[var(--border-main)] rounded-xl grayscale bg-[var(--bg-surface)] brutal-shadow-sm object-cover`} />
                  ) : (
                    <div className={`${avatarSize} border-2 border-[var(--border-main)] rounded-xl grayscale bg-[var(--bg-surface)] brutal-shadow-sm flex items-center justify-center font-black text-[18px] leading-none text-[var(--bg-contrast)]`}>
                      {getInitials(p.name)}
                    </div>
                  )}
                </Link>
                <div className="absolute -bottom-2 -right-1 bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic text-[10px] px-1.5 py-0.5 rounded-md border border-[var(--bg-surface)]">
                  {getVal(p)}
                </div>
              </div>

              <div className={`${height} w-full border-x-4 border-t-4 border-[var(--border-main)] flex flex-col items-center justify-start pt-3 rounded-t-xl bg-[var(--border-main)]/5 transition-all`}>
                <div className={`font-black italic text-2xl leading-none ${isFirst ? "opacity-100" : "opacity-20"}`}>{rank}</div>
                <div className="text-[10px] font-black uppercase italic truncate w-full px-2 text-center mt-2 tracking-tight">{p.name}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PaymentReportOverlay = ({
  players,
  statuses,
  isPayer,
  isAdmin,
  isLoading,
  onClose,
  onDecision
}: {
  players: Player[];
  statuses: { tg_id: number; status: string }[];
  isPayer: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onClose: () => void;
  onDecision: (tgId: number, approved: boolean) => void;
}) => {
  const canDecide = isPayer || isAdmin;
  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-contrast)]/80 flex items-end animate-in fade-in">
      <div className="w-full bg-[var(--bg-surface)] border-t-4 border-[var(--border-main)] rounded-t-[40px] p-6 max-h-[85vh] overflow-y-auto brutal-shadow animate-in slide-in-from-bottom-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black italic uppercase text-[var(--text-main)]">ПОДТВЕРДИТЬ ОПЛАТЫ</h3>
          <button onClick={onClose} className="w-10 h-10 border-2 border-[var(--border-main)] flex items-center justify-center font-black rounded-full text-[var(--text-main)]">
            X
          </button>
        </div>
        <div className="space-y-3">
          {players.map((p) => {
            const status = statuses.find((item) => item.tg_id === p.tg_id)?.status || "unpaid";
            const label = paymentStatusLabel(status as PaymentStatusLabel);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 border-2 border-[var(--border-main)] rounded-2xl p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black italic uppercase text-[var(--text-main)]">{p.name}</div>
                  <div className="text-[10px] font-bold uppercase opacity-50 text-[var(--text-main)]">{label}</div>
                </div>
                {canDecide ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDecision(p.tg_id, true)}
                      disabled={isLoading}
                      className="px-3 py-2 border-2 border-[var(--border-main)] rounded-xl font-black italic text-[10px] uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onDecision(p.tg_id, false)}
                      disabled={isLoading}
                      className="px-3 py-2 border-2 border-[var(--border-main)] rounded-xl font-black italic text-[10px] uppercase bg-[var(--bg-surface)] text-[var(--text-main)]"
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PayerSelectOverlay = ({
  players,
  onClose,
  onSelect
}: {
  players: Player[];
  onClose: () => void;
  onSelect: (tgId: number) => void;
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-contrast)]/80 flex items-end animate-in fade-in">
      <div className="w-full bg-[var(--bg-surface)] border-t-4 border-[var(--border-main)] rounded-t-[40px] p-6 max-h-[85vh] overflow-y-auto brutal-shadow animate-in slide-in-from-bottom-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black italic uppercase text-[var(--text-main)]">ВЫБРАТЬ ПЛАТЕЛЬЩИКА</h3>
          <button onClick={onClose} className="w-10 h-10 border-2 border-[var(--border-main)] flex items-center justify-center font-black rounded-full text-[var(--text-main)]">
            X
          </button>
        </div>
        <div className="space-y-2">
          {players.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-xl border-2 border-[var(--border-main)] px-3 py-2 text-sm">
              <span className="font-black italic uppercase text-[var(--text-main)]">{member.name}</span>
              <button
                onClick={() => onSelect(member.tg_id)}
                className="px-3 py-2 border-2 border-[var(--border-main)] rounded-xl font-black italic text-[10px] uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
              >
                SELECT
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};









