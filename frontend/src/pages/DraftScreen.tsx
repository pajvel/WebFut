import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  RotateCcw,
  Swords,
  Trophy,
  Undo2,
  Users,
  X,
} from "lucide-react";

import {
  initDraft,
  setDraftCaptains,
  draftPick,
  draftUndo,
  getDraftStatus,
  cancelDraft,
} from "../lib/api";
import { useAppContext } from "../lib/app-context";
import type {
  DraftCaptainSuggestion,
  DraftParticipant,
  DraftState,
} from "../lib/types";

export function DraftScreen() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { me } = useAppContext();
  const mid = Number(matchId);

  const [phase, setPhase] = useState<
    "loading" | "captain_selection" | "picking" | "completed" | "cancelled" | "error"
  >("loading");
  const [captainSuggestions, setCaptainSuggestions] = useState<
    DraftCaptainSuggestion[]
  >([]);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedPair, setSelectedPair] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [picking, setPicking] = useState(false);
  const [manualCaptainMode, setManualCaptainMode] = useState(false);
  const [manualCaptainA, setManualCaptainA] = useState<number | null>(null);
  const [manualCaptainB, setManualCaptainB] = useState<number | null>(null);

  /** Try to resume or start fresh. */
  const loadDraft = useCallback(async () => {
    try {
      const existing = await getDraftStatus(mid);
      if (existing) {
        setDraft(existing as DraftState);
        // Populate participants from the response
        if ((existing as any).participants) {
          setParticipants((existing as any).participants);
        }
        setPhase(existing.status);
        return;
      }
    } catch {
      /* no active draft */
    }
    // Init a new draft
    try {
      const data = await initDraft(mid);
      setCaptainSuggestions(data?.captain_suggestions ?? []);
      setParticipants(data?.participants ?? []);
      setPhase("captain_selection");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  }, [mid]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // ── Captain Selection ─────────────────────────────────────────────────

  const handleSelectCaptains = async () => {
    let captA: number;
    let captB: number;
    if (manualCaptainMode) {
      if (!manualCaptainA || !manualCaptainB) return;
      captA = manualCaptainA;
      captB = manualCaptainB;
    } else {
      const pair = captainSuggestions[selectedPair];
      if (!pair) return;
      captA = pair.captain_a.tg_id;
      captB = pair.captain_b.tg_id;
    }
    try {
      const data = await setDraftCaptains(mid, captA, captB);
      setDraft(data as DraftState);
      setPhase("picking");
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleManualCaptainTap = (tgId: number) => {
    if (manualCaptainA === tgId) {
      setManualCaptainA(null);
      return;
    }
    if (manualCaptainB === tgId) {
      setManualCaptainB(null);
      return;
    }
    if (!manualCaptainA) {
      setManualCaptainA(tgId);
    } else if (!manualCaptainB) {
      setManualCaptainB(tgId);
    } else {
      // Replace B with new pick
      setManualCaptainB(tgId);
    }
  };

  // ── Pick ───────────────────────────────────────────────────────────────

  const handlePick = async (pickedTgId: number) => {
    if (picking) return;
    setPicking(true);
    try {
      const data = await draftPick(mid, pickedTgId);
      setDraft(data as DraftState);
      if (data?.status === "completed") {
        setPhase("completed");
      }
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setPicking(false);
    }
  };

  const handleUndo = async () => {
    try {
      const data = await draftUndo(mid);
      setDraft(data as DraftState);
      setPhase(data?.status ?? "picking");
    } catch {
      /* ignore */
    }
  };

  const handleCancel = async () => {
    try {
      await cancelDraft(mid);
      navigate(-1);
    } catch {
      /* ignore */
    }
  };

  const handleRedraft = async () => {
    try {
      await cancelDraft(mid);
    } catch {
      /* ignore cancel errors */
    }
    setDraft(null);
    setPhase("loading");
    try {
      const data = await initDraft(mid);
      setCaptainSuggestions(data?.captain_suggestions ?? []);
      setParticipants(data?.participants ?? []);
      setPhase("captain_selection");
    } catch (e) {
      setErrorMsg(String(e));
      setPhase("error");
    }
  };

  // ── Helper: find participant info ─────────────────────────────────────

  const findPlayer = (tgId: number | string): DraftParticipant => {
    const id = Number(tgId);
    return (
      participants.find((p) => p.tg_id === id) ??
      draft?.pool.find((p) => p.tg_id === id) ?? { tg_id: id }
    );
  };

  const isMyTurn =
    draft?.current_captain_tg_id === me?.tg_id || me?.is_admin === true;

  // ── Render phases ─────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-webfut-pink border-t-transparent" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="px-4 pt-6 text-center">
        <X className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm text-gray-400">{errorMsg}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 pt-3 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Капитанский Драфт
          </h1>
          <p className="text-xs text-gray-500">Матч #{matchId}</p>
        </div>
        {phase !== "completed" && (
          <button
            onClick={handleCancel}
            className="ml-auto rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400"
          >
            Отмена
          </button>
        )}
      </motion.div>

      {/* ── CAPTAIN SELECTION PHASE ─────────────────────────────────────── */}
      {phase === "captain_selection" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Mode toggle */}
          <div className="flex rounded-xl border-2 border-[var(--border-main)] overflow-hidden">
            <button
              onClick={() => setManualCaptainMode(false)}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                !manualCaptainMode
                  ? "bg-webfut-pink/20 text-webfut-pink"
                  : "bg-[var(--bg-surface)] text-gray-500"
              }`}
            >
              ИИ подбор
            </button>
            <button
              onClick={() => setManualCaptainMode(true)}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                manualCaptainMode
                  ? "bg-webfut-pink/20 text-webfut-pink"
                  : "bg-[var(--bg-surface)] text-gray-500"
              }`}
            >
              Выбрать вручную
            </button>
          </div>

          {!manualCaptainMode ? (
            /* AI suggestions */
            <div className="rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                <Crown className="h-4 w-4 text-webfut-pink" />
                Выбери пару капитанов
              </h2>
              <p className="mb-4 text-xs text-gray-400">
                ИИ подобрал пары по ближайшему рейтингу
              </p>
              <div className="space-y-2">
                {captainSuggestions.map((s, idx) => (
                  <motion.button
                    key={idx}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedPair(idx)}
                    className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                      selectedPair === idx
                        ? "border-webfut-pink bg-webfut-pink/10"
                        : "border-[var(--border-main)] bg-[var(--bg-page)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PlayerBadge player={s.captain_a} team="A" />
                        <span className="text-xs font-bold text-gray-500">vs</span>
                        <PlayerBadge player={s.captain_b} team="B" />
                      </div>
                      <div className="text-xs text-gray-500">
                        Δ {s.diff.toFixed(1)}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* Manual selection */
            <div className="rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                <Crown className="h-4 w-4 text-webfut-pink" />
                Нажми на двух игроков
              </h2>
              <p className="mb-4 text-xs text-gray-400">
                {manualCaptainA && manualCaptainB
                  ? "Оба капитана выбраны!"
                  : manualCaptainA
                    ? "Выбери второго капитана"
                    : "Выбери первого капитана"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {participants.map((p) => {
                  const isA = manualCaptainA === p.tg_id;
                  const isB = manualCaptainB === p.tg_id;
                  const isSelected = isA || isB;
                  return (
                    <motion.button
                      key={p.tg_id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleManualCaptainTap(p.tg_id)}
                      className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-webfut-pink bg-webfut-pink/10"
                          : "border-[var(--border-main)] bg-[var(--bg-page)]"
                      }`}
                    >
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-gray-400">
                          {(p.name ?? "?")[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text-main)] truncate">
                          {p.name ?? `#${p.tg_id}`}
                        </div>
                        {p.rating !== undefined && (
                          <div className="text-[10px] text-gray-500">R: {p.rating.toFixed(1)}</div>
                        )}
                      </div>
                      {isA && (
                        <span className="text-[10px] font-bold text-webfut-pink">К1</span>
                      )}
                      {isB && (
                        <span className="text-[10px] font-bold text-webfut-pink">К2</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSelectCaptains}
            disabled={manualCaptainMode && (!manualCaptainA || !manualCaptainB)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-webfut-pink bg-webfut-pink/20 py-3 text-sm font-bold text-webfut-pink disabled:opacity-30"
          >
            <Swords className="h-4 w-4" />
            Начать драфт
          </motion.button>
        </motion.div>
      )}

      {/* ── PICKING PHASE ──────────────────────────────────────────────── */}
      {(phase === "picking" || phase === "completed") && draft && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Status Banner */}
          <div
            className={`rounded-2xl border-2 p-4 text-center ${
              phase === "completed"
                ? "border-webfut-pink/50 bg-webfut-pink/10"
                : isMyTurn
                  ? "border-webfut-pink bg-webfut-pink/10"
                  : "border-[var(--border-main)] bg-[var(--bg-surface)]"
            }`}
          >
            {phase === "completed" ? (
              <div className="flex items-center justify-center gap-2 text-webfut-pink">
                <Trophy className="h-5 w-5" />
                <span className="text-sm font-bold">Драфт завершён!</span>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400">Ход капитана</p>
                <p className="mt-1 text-lg font-black text-[var(--text-main)]">
                  {findPlayer(draft.current_captain_tg_id ?? 0).name ??
                    `#${draft.current_captain_tg_id}`}
                </p>
                {isMyTurn && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 text-xs font-semibold text-webfut-pink"
                  >
                    {draft.current_captain_tg_id === me?.tg_id
                      ? "Твой ход! Выбери игрока"
                      : "Выбери игрока за капитана"}
                  </motion.p>
                )}
              </div>
            )}
          </div>

          {/* Suggested Pair */}
          {phase === "picking" && draft.suggested_pair && draft.suggested_pair.length >= 2 && (
            <div className="rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Выбери одного
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {draft.suggested_pair.map((tgId) => {
                  const player = findPlayer(tgId);
                  return (
                    <motion.button
                      key={tgId}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                      disabled={picking || !isMyTurn}
                      onClick={() => handlePick(tgId)}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-page)] p-4 transition-all hover:border-webfut-pink hover:bg-webfut-pink/10 disabled:opacity-40"
                    >
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt=""
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-gray-400">
                          {(player.name ?? "?")[0]}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-[var(--text-main)]">
                        {player.name ?? `#${tgId}`}
                      </span>
                      {player.rating !== undefined && (
                        <span className="text-xs text-gray-500">
                          R: {player.rating.toFixed(1)}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teams */}
          <div className="grid grid-cols-2 gap-3">
            <TeamColumn
              label="Команда A"
              accent={false}
              players={(draft.teams?.A ?? []).map((id) => findPlayer(id))}
              captainTgId={draft.captain_a?.tg_id}
            />
            <TeamColumn
              label="Команда B"
              accent={true}
              players={(draft.teams?.B ?? []).map((id) => findPlayer(id))}
              captainTgId={draft.captain_b?.tg_id}
            />
          </div>

          {/* Undo Button */}
          {phase === "picking" && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleUndo}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/10"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Отменить последний пик
            </motion.button>
          )}

          {/* Finish / Re-draft */}
          {phase === "completed" && (
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/matches/${mid}/teams`)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-webfut-pink bg-webfut-pink/20 py-3 text-sm font-bold text-webfut-pink"
              >
                <Check className="h-4 w-4" />
                Применить
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRedraft}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-gray-400"
              >
                <RotateCcw className="h-4 w-4" />
              </motion.button>
            </div>
          )}

          {/* Pick History */}
          {draft.picks && draft.picks.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] p-4"
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                История пиков
              </h3>
              <div className="space-y-1.5">
                {draft.picks.map((pick, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-5 text-gray-600">#{pick.pick_number + 1}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        pick.assigned_team === "A"
                          ? "bg-white/10 text-[var(--text-main)]"
                          : "bg-webfut-pink/20 text-webfut-pink"
                      }`}
                    >
                      {pick.assigned_team}
                    </span>
                    <span className="text-[var(--text-main)]">
                      {findPlayer(pick.picked_tg_id).name ?? `#${pick.picked_tg_id}`}
                    </span>
                    {pick.auto_assigned_tg_id && (
                      <>
                        <span className="text-gray-600">→</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            pick.auto_assigned_team === "A"
                              ? "bg-white/10 text-[var(--text-main)]"
                              : "bg-webfut-pink/20 text-webfut-pink"
                          }`}
                        >
                          {pick.auto_assigned_team}
                        </span>
                        <span className="text-[var(--text-main)]">
                          {findPlayer(pick.auto_assigned_tg_id).name ??
                            `#${pick.auto_assigned_tg_id}`}
                        </span>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PlayerBadge({
  player,
  team,
}: {
  player: DraftParticipant;
  team: "A" | "B";
}) {
  return (
    <div className="flex items-center gap-2">
      {player.avatar ? (
        <img
          src={player.avatar}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-gray-400">
          {(player.name ?? "?")[0]}
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-[var(--text-main)]">
          {player.name ?? `#${player.tg_id}`}
        </div>
        {player.rating !== undefined && (
          <div className="text-[10px] text-gray-500">
            R: {player.rating.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamColumn({
  label,
  accent,
  players,
  captainTgId,
}: {
  label: string;
  accent: boolean;
  players: DraftParticipant[];
  captainTgId?: number;
}) {
  return (
    <div className={`rounded-2xl border-2 p-3 ${
      accent
        ? "border-webfut-pink/30 bg-webfut-pink/5"
        : "border-[var(--border-main)] bg-[var(--bg-surface)]"
    }`}>
      <h3 className={`mb-2 text-xs font-bold uppercase tracking-wider ${
        accent ? "text-webfut-pink" : "text-[var(--text-main)] opacity-60"
      }`}>
        {label}
      </h3>
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {players.map((player) => (
            <motion.div
              key={player.tg_id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2"
            >
              {player.avatar ? (
                <img
                  src={player.avatar}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-gray-400">
                  {(player.name ?? "?")[0]}
                </div>
              )}
              <span className="flex-1 truncate text-xs font-medium text-[var(--text-main)]">
                {player.name ?? `#${player.tg_id}`}
              </span>
              {player.tg_id === captainTgId && (
                <Crown className="h-3 w-3 text-webfut-pink" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {players.length === 0 && (
          <div className="py-2 text-center text-[10px] text-gray-600">
            <Users className="mx-auto mb-1 h-4 w-4" />
            Пусто
          </div>
        )}
      </div>
    </div>
  );
}
