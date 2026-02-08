import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  apiFetch,
  customTeams,
  generateTeams,
  getMatch,
  revertTeams,
  selectTeams,
  startMatch
} from "../lib/api";
import { ApiError } from "../lib/api";
import type { MatchDetail, TeamVariant } from "../lib/types";
import { formatApiError } from "../lib/errors";
import { StatusCard } from "../components/StatusCard";
import { SaveTeamsSheet } from "../components/SaveTeamsSheet";
import { resolveMediaUrl } from "../lib/media";

type TeamState = {
  A: string[];
  B: string[];
};

const normalizeTeams = (teams: { A?: string[]; B?: string[]; team_a?: string[]; team_b?: string[] }) => {
  if (teams.A && teams.B) {
    return { A: teams.A.map(String), B: teams.B.map(String) };
  }
  return { A: (teams.team_a || []).map(String), B: (teams.team_b || []).map(String) };
};

const sanitizeTeams = (teams: TeamState) => ({
  A: (teams.A || []).map(String).filter(Boolean),
  B: (teams.B || []).map(String).filter(Boolean)
});

export function TeamVariants() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [variants, setVariants] = useState<TeamVariant[]>([]);
  const [selected, setSelected] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const generatedParam = searchParams.get("generated") === "1";
  const [teams, setTeams] = useState<TeamState | null>(null);
  const [customized, setCustomized] = useState(false);
  const [whyText, setWhyText] = useState<string | null>(null);
  const [powerOverride, setPowerOverride] = useState<{ avg_a: number; avg_b: number; d_hat: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(generatedParam);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<"A" | "B" | null>(null);
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number } | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const initializedRef = useRef(false);
  const selectedRef = useRef(1);
  const customizedRef = useRef(false);
  const lastSelectRef = useRef(0);
  const dirtyRef = useRef(false);
  const lastLocalChangeRef = useRef(0);
  const customUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (generatedParam) {
      setHasGenerated(true);
      setSearchParams({}, { replace: true });
    }
  }, [generatedParam, setSearchParams]);

  useEffect(() => {
    const onTeamsBack = () => setExitOpen(true);
    window.addEventListener("teams-back", onTeamsBack);
    return () => window.removeEventListener("teams-back", onTeamsBack);
  }, []);

  useEffect(() => {
    if (!matchId) return;
    
    const loadMatchData = async () => {
      try {
        const result = await getMatch(Number(matchId));
        if (typeof window !== "undefined") {
          localStorage.setItem("match_status", result.match.status);
        }
        setData(result);
        
        // ���� ������ ����� ��������� �� "live", ��������� �� �������� live �����
        if (result.match.status === "live") {
          navigate(`/matches/${matchId}/live`);
          return;
        }
        
        const normalized = (result.team_variants || []).map((variant) => ({
          ...variant,
          teams: normalizeTeams(variant.teams)
        }));
        setVariants(normalized);
        const canEdit =
          result.me.is_admin ||
          result.members.some((m) => m.tg_id === result.me.tg_id && m.role === "organizer");

        const isEditor =
          result.me.is_admin ||
          result.members.some((m) => m.tg_id === result.me.tg_id && m.role === "organizer");
        const lockTeams =
          isEditor &&
          (dirtyRef.current || customizedRef.current) &&
          Date.now() - lastLocalChangeRef.current < 4000;

        if (result.team_current) {
          setHasGenerated(true);
          const baseNo = result.team_current.base_variant_no;
          const baseIndex = normalized.findIndex((variant) => variant.variant_no === baseNo);
          const recentlySelected = Date.now() - lastSelectRef.current < 5000;
          const shouldApply =
            (!lockTeams &&
              (!initializedRef.current ||
            !canEdit ||
            !recentlySelected ||
              selectedRef.current === baseNo));
          if (shouldApply) {
            setSelected(baseNo);
            selectedRef.current = baseNo;
            setTeams(normalizeTeams(result.team_current.current_teams));
            setCurrentIndex(baseIndex >= 0 ? baseIndex : 0);
            setCustomized(result.team_current.is_custom);
            customizedRef.current = result.team_current.is_custom;
            setWhyText(result.team_current.why_now_worse_text || null);
            setPowerOverride(result.team_current.power || null);
            dirtyRef.current = false;
          }
          if (!shouldApply && result.team_current.why_now_worse_text) {
            setWhyText(result.team_current.why_now_worse_text || null);
          }
        } else if (normalized.length) {
          const shouldShow = hasGenerated || generatedParam;
          setHasGenerated((prev) => prev || generatedParam);
          if (!initializedRef.current) {
            setSelected(normalized[0].variant_no);
            selectedRef.current = normalized[0].variant_no;
            setTeams(shouldShow ? normalized[0].teams : null);
            setCurrentIndex(0);
            setCustomized(false);
            customizedRef.current = false;
            setWhyText(null);
            setPowerOverride(normalized[0].power || null);
          } else {
            const selectedIndex = normalized.findIndex((variant) => variant.variant_no === selectedRef.current);
            if (selectedIndex >= 0) {
              setCurrentIndex(selectedIndex);
              if (!customizedRef.current && !lockTeams) {
                setTeams(shouldShow ? normalized[selectedIndex].teams : null);
              }
            } else {
              setSelected(normalized[0].variant_no);
              selectedRef.current = normalized[0].variant_no;
              setTeams(shouldShow ? normalized[0].teams : null);
              setCurrentIndex(0);
              setCustomized(false);
              customizedRef.current = false;
              setWhyText(null);
              setPowerOverride(normalized[0].power || null);
            }
          }
        } else if (generatedParam || hasGenerated) {
          const fallback = allPlayers.map((p) => p.id);
          const fallbackVariant: TeamVariant = {
            variant_no: 1,
            is_recommended: true,
            teams: { A: fallback, B: [] },
            why_text: null
          };
          setVariants([fallbackVariant]);
          setSelected(fallbackVariant.variant_no);
          selectedRef.current = fallbackVariant.variant_no;
          setTeams(fallbackVariant.teams);
          setHasGenerated(true);
          setCustomized(false);
          customizedRef.current = false;
          setCurrentIndex(0);
          setWhyText(null);
          setPowerOverride(null);
        }
        initializedRef.current = true;
      } catch (err) {
        setError(formatApiError(err));
      }
    };
    
    loadMatchData();
    
    // ��������� polling ��� real-time ����������
    const interval = setInterval(loadMatchData, 3000); // ��������� ������ 3 �������
    
    return () => clearInterval(interval);
  }, [matchId, generatedParam, hasGenerated]);

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
        avatar: member.avatar,
        rating: member.rating
      }));
  }, [data]);

  useEffect(() => {
    if (!hasGenerated) return;
    if (teams) return;
    if (variants.length) {
      setTeams(variants[currentIndex]?.teams || variants[0].teams);
      return;
    }
    if (allPlayers.length) {
      setTeams({ A: allPlayers.map((p) => p.id), B: [] });
    }
  }, [hasGenerated, teams, variants, currentIndex, allPlayers]);

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
    customizedRef.current = true;
    lastSelectRef.current = Date.now();
    lastLocalChangeRef.current = Date.now();
    dirtyRef.current = true;
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
    customizedRef.current = true;
    lastSelectRef.current = Date.now();
    lastLocalChangeRef.current = Date.now();
    dirtyRef.current = true;
    if (customUpdateTimerRef.current) {
      clearTimeout(customUpdateTimerRef.current);
    }
    customUpdateTimerRef.current = setTimeout(() => {
      updateWhyText(next);
    }, 250);
  };

  const handleSave = async (teamA?: string, teamB?: string) => {
    if (!matchId) return;
    try {
      if (customizedRef.current && teams) {
        const payloadTeams = sanitizeTeams(teams);
        await customTeams(Number(matchId), {
          base_variant_no: selectedRef.current,
          teams: payloadTeams,
          team_name_a: teamA,
          team_name_b: teamB,
          // Extra fields for backend compatibility
          A: payloadTeams.A,
          B: payloadTeams.B
        } as unknown as {
          base_variant_no: number;
          teams: { A: string[]; B: string[] };
          team_name_a?: string;
          team_name_b?: string;
          A?: string[];
          B?: string[];
        });
      } else {
        await selectTeams(Number(matchId), selectedRef.current, {
          team_name_a: teamA,
          team_name_b: teamB
        });
      }
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
        selectedRef.current = normalized[0].variant_no;
        setTeams(normalized[0].teams);
        setHasGenerated(true);
        setCustomized(false);
        customizedRef.current = false;
        setCurrentIndex(0);
        setWhyText(null);
        setPowerOverride(normalized[0].power || null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const fallback = allPlayers.map((p) => p.id);
        const fallbackVariant: TeamVariant = {
          variant_no: 1,
          is_recommended: true,
          teams: { A: fallback, B: [] },
          why_text: null
        };
        setVariants([fallbackVariant]);
        setSelected(fallbackVariant.variant_no);
        selectedRef.current = fallbackVariant.variant_no;
        setTeams(fallbackVariant.teams);
        setHasGenerated(true);
        setCustomized(false);
        customizedRef.current = false;
        setCurrentIndex(0);
        setWhyText(null);
        setPowerOverride(null);
        return;
      }
      setError(formatApiError(err));
    }
  };

  const handleCancelGeneration = async () => {
    if (!matchId) return;
    try {
      await apiFetch(`/matches/${matchId}/teams/cancel`, { method: "POST" });
      if (typeof window !== "undefined") {
        localStorage.setItem("match_status", "created");
      }
      navigate(`/matches/${matchId}`);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleKeepTeams = async () => {
    if (!matchId) return;
    try {
      if (teams) {
        const payloadTeams = sanitizeTeams(teams);
        await customTeams(Number(matchId), {
          base_variant_no: selectedRef.current,
          teams: payloadTeams,
          A: payloadTeams.A,
          B: payloadTeams.B
        } as unknown as { base_variant_no: number; teams: TeamState; A?: string[]; B?: string[] });
        dirtyRef.current = false;
      }
      navigate(`/matches/${matchId}`);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleDrop = (team: "A" | "B", playerId: string) => {
    movePlayer(team, playerId);
  };

  const effectiveTeams = teams || (hasGenerated ? { A: allPlayers.map((p) => p.id), B: [] } : { A: [], B: [] });
  const currentVariant = variants[currentIndex];
  const dataTeams =
    data?.team_current?.current_teams ||
    (data?.team_variants?.[currentIndex]?.teams as unknown as TeamState | undefined) ||
    (data?.team_variants?.[0]?.teams as unknown as TeamState | undefined) ||
    null;
  const powerTeamsRaw =
    teams ||
    (currentVariant?.teams as TeamState | undefined) ||
    (variants[0]?.teams as TeamState | undefined) ||
    dataTeams ||
    (hasGenerated ? { A: allPlayers.map((p) => p.id), B: [] } : { A: [], B: [] });
  const powerTeams = powerTeamsRaw ? sanitizeTeams(normalizeTeams(powerTeamsRaw as TeamState)) : { A: [], B: [] };
  const teamA = powerTeams.A || [];
  const teamB = powerTeams.B || [];
  const getRating = (id: string) => {
    const value = Number(allPlayers.find((p) => p.id === id)?.rating);
    return Number.isFinite(value) && value > 0 ? value : 1000;
  };
  const teamAAvg =
    teamA.length && allPlayers.length ? teamA.reduce((sum, id) => sum + getRating(id), 0) / teamA.length : 0;
  const teamBAvg =
    teamB.length && allPlayers.length ? teamB.reduce((sum, id) => sum + getRating(id), 0) / teamB.length : 0;
  const powerData =
    powerOverride ||
    currentVariant?.power ||
    data?.team_current?.power ||
    data?.team_variants?.[currentIndex]?.power ||
    data?.team_variants?.[0]?.power ||
    null;
  const powerAvgA = powerData?.avg_a ?? teamAAvg;
  const powerAvgB = powerData?.avg_b ?? teamBAvg;
  const strengthDiff = powerData?.d_hat ?? powerAvgA - powerAvgB;
  const strengthLabel =
    Math.abs(strengthDiff) < 0.1
      ? "Баланс"
      : strengthDiff > 0
        ? `Сильнее TEAM A на ${Math.abs(strengthDiff).toFixed(1)}`
        : `Сильнее TEAM B на ${Math.abs(strengthDiff).toFixed(1)}`;
  const totalA = powerAvgA * (teamA.length || 1);
  const totalB = powerAvgB * (teamB.length || 1);
  const strengthPercent =
    totalA + totalB > 0
      ? Math.min(100, Math.max(0, (totalA / (totalA + totalB)) * 100))
      : 50;

  const updateWhyText = async (nextTeams: TeamState) => {
    if (!matchId) return;
    try {
      const payloadTeams = sanitizeTeams(nextTeams);
      const result = await customTeams(Number(matchId), {
        base_variant_no: selected,
        teams: payloadTeams,
        A: payloadTeams.A,
        B: payloadTeams.B
      } as unknown as { base_variant_no: number; teams: TeamState; A?: string[]; B?: string[] });
      const text = result?.why_text || null;
      setWhyText(text);
      if (result && "power" in result) {
        const power = (result as unknown as { power?: { avg_a: number; avg_b: number; d_hat: number } }).power;
        if (power) {
          setPowerOverride(power);
        }
      }
      if (teams) {
        const current = sanitizeTeams(teams);
        if (JSON.stringify(current) === JSON.stringify(payloadTeams)) {
          dirtyRef.current = false;
        }
      }
      return text;
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const selectIndex = async (nextIndex: number, nextDirection: number) => {
    if (!variants.length) return;
    const wrapped = (nextIndex + variants.length) % variants.length;
    setCurrentIndex(wrapped);
    const nextVariant = variants[wrapped];
    setSelected(nextVariant.variant_no);
    selectedRef.current = nextVariant.variant_no;
    lastSelectRef.current = Date.now();
    setTeams(hasGenerated ? nextVariant.teams : null);
    setCustomized(false);
    customizedRef.current = false;
    setWhyText(null);
    setPowerOverride(nextVariant.power || null);
    dirtyRef.current = false;
    if (matchId && canEditTeams) {
      try {
        await selectTeams(Number(matchId), nextVariant.variant_no);
      } catch (err) {
        setError(formatApiError(err));
      }
    }
  };

  const errorToast = error ? <StatusCard title="Ошибка" message={error} onClose={() => setError(null)} /> : null;

  if (!data) {
    return (
      <>
        {errorToast}
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      </>
    );
  }

  const isGenerating = hasGenerated;
  const formatLabel = `${Math.max(teamA.length, 2)} vs ${Math.max(teamB.length, 2)}`;

  return (
    <>
      {errorToast}
      <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-page)] relative">
      <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-48">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <h2 className="font-black italic text-[var(--text-main)] uppercase text-xl leading-none tracking-tighter">
              {formatLabel}
            </h2>
            <span className="font-bold text-[8px] opacity-50 uppercase tracking-widest text-[var(--text-main)]">
              Match Sync Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-main)] px-2 py-1 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
            <span className="font-black italic text-[9px] text-[var(--text-main)] opacity-60 uppercase tracking-widest">
              {isGenerating ? "GENERATING" : "WAITING"}
            </span>
          </div>
        </div>

        {canEditTeams && hasGenerated ? (
          <div className="space-y-2">
            <p className="font-black text-[9px] opacity-40 uppercase px-1 tracking-widest text-[var(--text-main)]">
              Balance Engine Presets
            </p>
            <div className="flex gap-1.5 p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)]">
              {variants.slice(0, 3).map((variant, i) => (
                <button
                  key={variant.variant_no}
                  onClick={() => selectIndex(i, i > currentIndex ? 1 : -1)}
                  className={`flex-1 py-2 font-black italic uppercase text-[10px] rounded-lg transition-all ${
                    currentIndex === i
                      ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] shadow-brutal-sm scale-[1.02]"
                      : "text-[var(--text-main)] opacity-40 hover:opacity-100"
                  }`}
                >
                  Preset {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {["A", "B"].map((team) => (
            <div key={team} className="space-y-2">
              <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-xl text-center">
                <span className="font-black italic text-[10px] text-[var(--text-main)] uppercase tracking-tighter">
                  TEAM {team}
                </span>
              </div>
              <div
                data-team={team}
                className={`space-y-1.5 transition ${dragOverTeam === team ? "scale-[1.02]" : ""} ${
                  !canEditTeams ? "pointer-events-none" : ""
                }`}
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
                {(() => {
                  const list = team === "A" ? teamA : teamB;
                  const maxSlots = Math.max(3, teamA.length, teamB.length);
                  const slots = Array.from({ length: maxSlots }, (_, idx) => list[idx] || null);
                  return slots.map((playerId, idx) => {
                    if (!playerId) {
                      return (
                        <div
                          key={`empty-${team}-${idx}`}
                          className="h-14 border-2 border-dashed border-[var(--border-main)] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center"
                          onDragOver={(event) => {
                            if (!canEditTeams) return;
                            event.preventDefault();
                            setDragOverTeam(team as "A" | "B");
                          }}
                          onDrop={(event) => {
                            if (!canEditTeams) return;
                            event.preventDefault();
                            const dropped = event.dataTransfer.getData("text/plain");
                            if (dropped) {
                              handleDrop(team as "A" | "B", dropped);
                            }
                          }}
                        >
                          <span className="font-black italic text-[8px] text-[var(--text-main)] opacity-40 uppercase tracking-widest">
                            EMPTY
                          </span>
                        </div>
                      );
                    }
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
                        className={`transition-all duration-200 ${
                          draggingId === player.id ? "scale-105 border-green-500 border-2 rounded-xl z-10" : ""
                        } ${canEditTeams ? "cursor-grab active:cursor-grabbing" : ""}`}
                        style={{
                          touchAction:
                            (draggingId === player.id || touchDragActive) && canEditTeams ? "none" : "pan-y"
                        }}
                      >
                        <div className="relative flex items-center border-[1.5px] border-[var(--border-main)] rounded-xl w-full bg-[var(--bg-surface)] text-[var(--text-main)] p-2 h-14">
                          {player.avatar ? (
                            <img
                              src={resolveMediaUrl(player.avatar)}
                              alt={player.name}
                              className="rounded-lg border border-[var(--border-main)] object-cover w-10 h-10"
                            />
                          ) : (
                            <div
                              className="rounded-lg border border-[var(--border-main)] flex items-center justify-center font-black uppercase w-10 h-10 text-[10px]"
                              style={{ background: "var(--bg-contrast)", color: "var(--text-contrast)" }}
                            >
                              {player.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="ml-2 flex-1 overflow-hidden">
                            <div className="font-black italic truncate uppercase tracking-tighter leading-none text-sm mb-1">
                              {player.name}
                            </div>
                            <div className="inline-block px-1 rounded font-black text-[8px] uppercase tracking-tighter border border-[var(--border-main)] bg-[var(--bg-page)] opacity-50">
                              Ranked Player
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ))}
        </div>

        {hasGenerated ? (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-4 shadow-brutal">
            <div className="flex items-center justify-between mb-3">
              <span className="font-black italic uppercase text-[10px] tracking-widest text-[var(--text-main)] opacity-50">
                Team Power
              </span>
              <span className="font-black text-[10px] uppercase text-[var(--text-main)]">{strengthLabel}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-black uppercase text-[var(--text-main)]">
              <span>TEAM A {teamA.length ? Math.round(powerAvgA) : "--"}</span>
              <span>TEAM B {teamB.length ? Math.round(powerAvgB) : "--"}</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full border-2 border-[var(--border-main)] bg-[var(--bg-page)] overflow-hidden">
              <div className="h-full bg-[var(--bg-contrast)]" style={{ width: `${strengthPercent}%` }} />
            </div>
          </div>
        ) : null}

        {hasGenerated && (currentVariant?.why_text || currentVariant?.explanation || whyText) ? (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 rounded-[2rem] border-l-[var(--border-main)] border-l-4">
            <h4 className="font-black italic uppercase text-[10px] opacity-40 mb-1 text-[var(--text-main)]">
              Strategy Analysis
            </h4>
            <p className="font-bold text-xs text-[var(--text-main)] italic leading-snug">
              {currentVariant?.why_text || currentVariant?.explanation || whyText || ""}
            </p>
          </div>
        ) : null}

        {canEditTeams && hasGenerated ? (
          <div className="space-y-3">
            <p className="font-black text-[9px] opacity-40 uppercase px-1 tracking-widest text-[var(--text-main)]">
              Recommended 1v1 Swaps
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => quickSwap("A", i)}
                  className="flex items-center justify-between p-3 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-2xl active:scale-95 shadow-brutal-sm group"
                >
                  <span className="font-black text-[10px] italic uppercase text-[var(--text-main)] truncate w-24 text-left">
                    {allPlayers[i]?.name || "PLAYER"}
                  </span>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-contrast)] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-contrast)" strokeWidth="3">
                      <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                    </svg>
                  </div>
                  <span className="font-black text-[10px] italic uppercase text-[var(--text-main)] truncate w-24 text-right">
                    {allPlayers[i + 3]?.name || "PLAYER"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {canEditTeams ? (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)] z-40">
          <button
            onClick={() => (hasGenerated ? setSaveOpen(true) : handleGenerate())}
            className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-4 font-black italic uppercase text-lg shadow-[6px_6px_0px_0px_var(--border-main)] border-2 border-[var(--border-main)] active:shadow-none transition-all"
          >
            {hasGenerated ? "Confirm Squads" : "Create Teams"}
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)] z-40">
          <div className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-3 font-black uppercase text-[10px] text-center text-[var(--text-main)]">
            �������� ������� ������������
          </div>
        </div>
      )}

      <SaveTeamsSheet open={saveOpen} onOpenChange={setSaveOpen} onStart={handleSave} />

      {exitOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] p-6 rounded-[2.5rem] shadow-[12px_12px_0px_0px_var(--border-main)]">
            <h2 className="font-black italic uppercase text-2xl mb-6 leading-none text-[var(--text-main)]">
              Exit Generator
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleKeepTeams}
                className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-4 font-black italic uppercase text-sm shadow-[6px_6px_0px_0px_var(--border-main)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                Keep Teams
              </button>
              <button
                onClick={handleCancelGeneration}
                className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-3 font-black uppercase text-[10px] active:scale-95 text-[var(--text-main)]"
              >
                Cancel Generation
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}

