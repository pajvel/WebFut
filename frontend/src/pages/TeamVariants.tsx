import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  customTeams,
  generateTeams,
  getMatch,
  revertTeams,
  selectTeams,
  startMatch
} from "../lib/api";
import type { MatchDetail, TeamVariant } from "../lib/types";
import { formatApiError } from "../lib/errors";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { StatusCard } from "../components/StatusCard";
import { SaveTeamsSheet } from "../components/SaveTeamsSheet";
import { resolveMediaUrl } from "../lib/media";

const swipeThreshold = 80;

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 120 : -120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -120 : 120, opacity: 0 })
};

type TeamState = {
  A: string[];
  B: string[];
};

const normalizeTeams = (teams: { A?: string[]; B?: string[]; team_a?: string[]; team_b?: string[] }) => {
  if (teams.A && teams.B) {
    return { A: teams.A, B: teams.B };
  }
  return { A: teams.team_a || [], B: teams.team_b || [] };
};

export function TeamVariants() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [variants, setVariants] = useState<TeamVariant[]>([]);
  const [selected, setSelected] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [teams, setTeams] = useState<TeamState | null>(null);
  const [customized, setCustomized] = useState(false);
  const [whyText, setWhyText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<"A" | "B" | null>(null);
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!matchId) return;
    
    const loadMatchData = async () => {
      try {
        const result = await getMatch(Number(matchId));
        setData(result);
        
        // Если статус матча изменился на "live", переходим на страницу live матча
        if (result.match.status === "live") {
          navigate(`/matches/${matchId}/live`);
          return;
        }
        
        const normalized = (result.team_variants || []).map((variant) => ({
          ...variant,
          teams: normalizeTeams(variant.teams)
        }));
        setVariants(normalized);
        if (result.team_current) {
          const baseNo = result.team_current.base_variant_no;
          const baseIndex = normalized.findIndex((variant) => variant.variant_no === baseNo);
          setSelected(baseNo);
          setTeams(normalizeTeams(result.team_current.current_teams));
          setCurrentIndex(baseIndex >= 0 ? baseIndex : 0);
          setCustomized(result.team_current.is_custom);
          setWhyText(result.team_current.why_now_worse_text || null);
        } else if (normalized.length) {
          setSelected(normalized[0].variant_no);
          setTeams(normalized[0].teams);
          setCurrentIndex(0);
          setCustomized(false);
          setWhyText(null);
        }
      } catch (err) {
        setError(formatApiError(err));
      }
    };
    
    loadMatchData();
    
    // Добавляем polling для real-time обновлений
    const interval = setInterval(loadMatchData, 3000); // обновляем каждые 3 секунды
    
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    if (!touchDragActive) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevent = (event: TouchEvent) => {
      event.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("touchmove", prevent);
    };
  }, [touchDragActive]);

  const allPlayers = useMemo(() => {
    if (!data) return [];
    return data.members
      .filter((member) => member.role !== "spectator")
      .map((member) => ({
        id: String(member.tg_id),
        name: member.name,
        avatar: member.avatar
      }));
  }, [data]);

  const canEditTeams = useMemo(() => {
    if (!data) return false;
    return data.me.is_admin || data.members.some(m => m.tg_id === data.me.tg_id && m.role === "organizer");
  }, [data]);
  const draggingPlayer = useMemo(
    () => (draggingId ? allPlayers.find((player) => player.id === draggingId) || null : null),
    [allPlayers, draggingId]
  );


  const quickSwap = async (from: "A" | "B", index: number) => {
    if (!teams) return;
    const other = from === "A" ? "B" : "A";
    const next = { ...teams, A: [...teams.A], B: [...teams.B] };
    const temp = next[from][index];
    next[from][index] = next[other][index] || temp;
    if (next[other][index]) {
      next[other][index] = temp;
    }
    setTeams(next);
    setCustomized(true);
    await updateWhyText(next);
  };

  const movePlayer = async (targetTeam: "A" | "B", playerId: string) => {
    if (!teams) return;
    const next = { A: [...teams.A], B: [...teams.B] };
    const fromTeam = next.A.includes(playerId) ? "A" : "B";
    if (fromTeam === targetTeam) return;
    next[fromTeam] = next[fromTeam].filter((id) => id !== playerId);
    next[targetTeam] = [...next[targetTeam], playerId];
    setTeams(next);
    setCustomized(true);
    await updateWhyText(next);
  };

  const handleSave = async (teamA?: string, teamB?: string) => {
    if (!matchId) return;
    try {
      await selectTeams(Number(matchId), selected, {
        team_name_a: teamA,
        team_name_b: teamB
      });
      await startMatch(Number(matchId));
      setSaveOpen(false);
      navigate(`/matches/${matchId}/live`);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleGenerate = async () => {
    if (!matchId) return;
    try {
      const result = await generateTeams(Number(matchId));
      const normalized = (result?.variants || []).map((variant) => ({
        ...variant,
        teams: normalizeTeams(variant.teams as { team_a?: string[]; team_b?: string[] })
      }));
      setVariants(normalized);
      if (normalized.length) {
        setSelected(normalized[0].variant_no);
        setTeams(normalized[0].teams);
        setCustomized(false);
        setCurrentIndex(0);
        setWhyText(null);
      }
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleDrop = (team: "A" | "B", playerId: string) => {
    movePlayer(team, playerId);
  };

  const teamA = teams?.A || [];
  const teamB = teams?.B || [];
  const currentVariant = variants[currentIndex];

  const updateWhyText = async (nextTeams: TeamState) => {
    if (!matchId) return;
    try {
      const result = await customTeams(Number(matchId), {
        base_variant_no: selected,
        teams: nextTeams
      });
      const text = result?.why_text || null;
      setWhyText(text);
      return text;
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const selectIndex = (nextIndex: number, nextDirection: number) => {
    if (!variants.length) return;
    const wrapped = (nextIndex + variants.length) % variants.length;
    setDirection(nextDirection);
    setCurrentIndex(wrapped);
    const nextVariant = variants[wrapped];
    setSelected(nextVariant.variant_no);
    setTeams(nextVariant.teams);
    setCustomized(false);
    setWhyText(null);
  };

  if (error) {
    return <StatusCard title="Ошибка" message={error} />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {canEditTeams ? "Создание команд" : "Варианты команд"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {canEditTeams ? "Горизонтальный свайп между вариантами" : "Ожидайте решения организатора"}
          </p>
        </div>
        {canEditTeams ? (
          <Button variant="outline" size="sm" onClick={handleGenerate} className="gap-2">
            <Shuffle className="h-4 w-4" />
            Пересчитать
          </Button>
        ) : null}
      </div>

      {currentVariant ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentVariant.variant_no}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -swipeThreshold) {
                selectIndex(currentIndex + 1, 1);
              } else if (info.offset.x > swipeThreshold) {
                selectIndex(currentIndex - 1, -1);
              }
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <Card className="border-primary/60">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Вариант {currentVariant.variant_no}</div>
                  {currentVariant.is_recommended ? (
                    <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold">
                      Рекомендован
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Команда A</div>
                    <div>{currentVariant.teams.A.length} игроков</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Команда B</div>
                    <div>{currentVariant.teams.B.length} игроков</div>
                  </div>
                </div>
                
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      ) : null}

      {variants.length > 1 ? (
        <div className="flex justify-center gap-2">
          {variants.map((variant, index) => (
            <button
              key={variant.variant_no}
              type="button"
              onClick={() => selectIndex(index, index > currentIndex ? 1 : -1)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                index === currentIndex ? "bg-primary" : "bg-muted"
              }`}
              aria-label={`Вариант ${variant.variant_no}`}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {["A", "B"].map((team) => (
          <Card key={team}>
            <CardContent className="space-y-3">
              <div className="text-sm font-semibold">
                Команда {team}
                <span
                  className={`ml-2 inline-flex h-2 w-2 rounded-full ${
                    team === "A" ? "bg-primary" : "bg-secondary"
                  }`}
                />
              </div>
              <div
                data-team={team}
                className={`space-y-2 rounded-xl p-1 transition ${
                  dragOverTeam === team ? "bg-primary/10" : "bg-transparent"
                } ${!canEditTeams ? "pointer-events-none" : ""}`}
                onDragOver={(event) => {
                  if (!canEditTeams) return;
                  event.preventDefault();
                  setDragOverTeam(team as "A" | "B");
                }}
                onDragLeave={() => setDragOverTeam(null)}
                onDrop={(event) => {
                  if (!canEditTeams) return;
                  event.preventDefault();
                  setDragOverTeam(null);
                  const playerId = event.dataTransfer.getData("text/plain");
                  if (playerId) {
                    handleDrop(team as "A" | "B", playerId);
                  }
                }}
              >
                {(team === "A" ? teamA : teamB).map((playerId) => {
                  const player = allPlayers.find((p) => p.id === playerId);
                  if (!player) return null;
                  return (
                    <div
                      key={player.id}
                      draggable={canEditTeams}
                      onTouchStart={() => {
                        if (!canEditTeams) return;
                        setDraggingId(player.id);
                        setTouchDragActive(true);
                        setTouchGhost(null);
                      }}
                      onTouchMove={(event) => {
                        if (!canEditTeams) return;
                        event.preventDefault();
                        const touch = event.touches[0];
                        if (!touch) return;
                        setTouchGhost({ x: touch.clientX, y: touch.clientY });
                      }}
                      onTouchEnd={(event) => {
                        if (!canEditTeams) return;
                        const touch = event.changedTouches[0];
                        const target = document.elementFromPoint(touch.clientX, touch.clientY);
                        const dropZone = target?.closest?.("[data-team]") as HTMLElement | null;
                        const dropTeam = dropZone?.dataset?.team as "A" | "B" | undefined;
                        if (dropTeam) {
                          handleDrop(dropTeam, player.id);
                        }
                        setDraggingId(null);
                        setTouchDragActive(false);
                        setTouchGhost(null);
                      }}
                      onTouchCancel={() => {
                        setDraggingId(null);
                        setTouchDragActive(false);
                        setTouchGhost(null);
                      }}
                      onDragStart={(event) => {
                        if (!canEditTeams) return;
                        event.dataTransfer.setData("text/plain", player.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(player.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-sm transition ${
                        draggingId === player.id
                          ? "scale-[1.02] rotate-1 shadow-soft ring-2 ring-primary/30"
                          : ""
                      } ${canEditTeams ? "cursor-grab active:cursor-grabbing" : ""}`}
                      style={{
                        touchAction:
                          (draggingId === player.id || touchDragActive) && canEditTeams ? "none" : "pan-y"
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border border-border">
                        {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                          <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {player.name}
                      </div>
                      {canEditTeams ? (
                        <button
                          type="button"
                          onClick={() =>
                            movePlayer(team === "A" ? "B" : "A", player.id)
                          }
                          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                          aria-label={team === "A" ? "В команду B" : "В команду A"}
                        >
                          {team === "A" ? (
                            <ArrowRight className="h-4 w-4" />
                          ) : (
                            <ArrowLeft className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {touchDragActive && draggingPlayer && touchGhost ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: touchGhost.x, top: touchGhost.y }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/90 px-3 py-2 text-sm shadow-soft">
            <Avatar className="h-7 w-7 border border-border">
              {draggingPlayer.avatar ? (
                <AvatarImage src={resolveMediaUrl(draggingPlayer.avatar)} />
              ) : null}
              <AvatarFallback>{draggingPlayer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="max-w-[140px] truncate">{draggingPlayer.name}</span>
          </div>
        </div>
      ) : null}

      {canEditTeams ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Быстрые замены
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => {
              const left = allPlayers[index];
              const right = allPlayers[index + 3];
              return (
                <motion.div key={index} whileTap={{ scale: 0.98 }}>
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border border-border">
                          {left?.avatar ? <AvatarImage src={resolveMediaUrl(left.avatar)} /> : null}
                          <AvatarFallback>{left?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        <Avatar className="h-7 w-7 border border-border">
                          {right?.avatar ? <AvatarImage src={resolveMediaUrl(right.avatar)} /> : null}
                          <AvatarFallback>{right?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickSwap("A", index)}
                        className="w-full"
                      >
                        Поменять
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      {customized ? (
        <Card>
          <CardContent className="space-y-2">
            <div className="text-sm font-semibold">Почему хуже</div>
            <div className="text-xs text-muted-foreground">
              {whyText || "Сборка стала менее сбалансированной. Можно вернуться к исходному варианту."}
            </div>
            {canEditTeams ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await revertTeams(Number(matchId));
                    const refreshed = await getMatch(Number(matchId));
                    const normalized = (refreshed.team_variants || []).map((variant) => ({
                      ...variant,
                      teams: normalizeTeams(variant.teams)
                    }));
                    setVariants(normalized);
                    if (refreshed.team_current) {
                      const baseNo = refreshed.team_current.base_variant_no;
                      const baseIndex = normalized.findIndex(
                        (variant) => variant.variant_no === baseNo
                      );
                      setSelected(baseNo);
                      setTeams(normalizeTeams(refreshed.team_current.current_teams));
                      setCurrentIndex(baseIndex >= 0 ? baseIndex : 0);
                    } else if (normalized.length) {
                      setSelected(normalized[0].variant_no);
                      setTeams(normalized[0].teams);
                      setCurrentIndex(0);
                    }
                    setCustomized(false);
                    setWhyText(null);
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
              >
                Вернуться
              </Button>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                Только организатор может вернуться к исходному варианту
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canEditTeams ? (
        <Button onClick={() => setSaveOpen(true)} className="w-full">
          Сохранить команды
        </Button>
      ) : (
        <Card>
          <CardContent className="text-center py-4">
            <div className="text-sm text-muted-foreground">
              Ожидайте, когда организатор сохранит состав команд
            </div>
          </CardContent>
        </Card>
      )}

      <SaveTeamsSheet open={saveOpen} onOpenChange={setSaveOpen} onStart={handleSave} />
    </div>
  );
}



