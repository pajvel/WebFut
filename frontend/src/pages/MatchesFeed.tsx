import { useEffect, useMemo, useState } from "react";
import { Plus, LayoutGrid } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createMatch, fetchMatches, fetchLobbies, getLobbyVenues } from "../lib/api";
import type { MatchSummary } from "../lib/types";
import { Sheet, SheetClose, SheetContent } from "../components/ui/sheet";
import { MatchCard } from "../components/MatchCard";
import { StatusCard } from "../components/StatusCard";
import { formatApiError } from "../lib/errors";
import { useMatText } from "../lib/mode18";
import { nowMskParts, toMskIsoString } from "../lib/datetime";

const venueOptions = [
  { value: "зал1", label: "Эксперт" },
  { value: "зал2", label: "Маракана" }
];

type LobbyVenueOption = {
  value: string;
  label: string;
};

export function MatchesFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useMatText();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [effectiveLobbyId, setEffectiveLobbyId] = useState<number | null>(null);
  const [lobbyVenueOptions, setLobbyVenueOptions] = useState<LobbyVenueOption[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venue, setVenue] = useState(venueOptions[0]?.value ?? "");
  const [scheduledDate, setScheduledDate] = useState(() => {
    return nowMskParts().date;
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    return nowMskParts().time;
  });
  const activeLobbyId = useMemo(() => {
    const raw = searchParams.get("lobby");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    const loadVenueOptions = async () => {
      setVenuesLoading(true);
      try {
        let contextId = activeLobbyId;
        if (!contextId) {
          const lobbyData = await fetchLobbies();
          contextId = lobbyData?.default_context_id ?? lobbyData?.lobbies?.[0]?.id ?? null;
        }
        if (!alive) return;
        setEffectiveLobbyId(contextId);
        if (!contextId) {
          setLobbyVenueOptions([]);
          setVenue("");
          return;
        }
        const data = await getLobbyVenues(contextId);
        if (!alive) return;
        const options = (data?.venues || []).map((item) => ({
          value: item.name,
          label: item.name
        }));
        setLobbyVenueOptions(options);
        setVenue((prev) => (options.some((option) => option.value === prev) ? prev : options[0]?.value ?? ""));
      } catch (err) {
        if (alive) {
          setLobbyVenueOptions([]);
          setVenue("");
          setError(formatApiError(err));
        }
      } finally {
        if (alive) {
          setVenuesLoading(false);
        }
      }
    };

    loadVenueOptions();
    return () => {
      alive = false;
    };
  }, [activeLobbyId]);

  useEffect(() => {
    let alive = true;

    const loadMatches = async (opts?: { append?: boolean; offset?: number }) => {
      try {
        const offset = opts?.offset ?? 0;
        const data = await fetchMatches({ limit: 30, offset, context_id: activeLobbyId ?? undefined });
        if (alive) {
          const items = data?.matches || [];
          setMatches((prev) => {
            if (!opts?.append) return items;
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const item of items) {
              if (!seen.has(item.id)) merged.push(item);
            }
            return merged;
          });
          setHasMore(Boolean(data?.paging?.has_more));
          setNextOffset(data?.paging?.next_offset ?? null);
          setLoading(false);
          setLoadingMore(false);
        }
      } catch (err) {
        if (alive) {
          setError(formatApiError(err));
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    loadMatches();
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadMatches();
    }, 10000);
    const onVisible = () => {
      if (!document.hidden) loadMatches();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeLobbyId]);

  useEffect(() => {
    if (!sheetOpen) return;
    if (scheduledDate && scheduledTime) return;
    const now = nowMskParts();
    setScheduledDate(now.date);
    setScheduledTime(now.time);
  }, [sheetOpen, scheduledDate, scheduledTime]);

  const activeMatches = useMemo(
    () => matches.filter((match) => match.status !== "finished"),
    [matches]
  );
  const finishedMatches = useMemo(
    () => matches.filter((match) => match.status === "finished"),
    [matches]
  );

  const handleCreate = async () => {
    setError(null);
    if (!venue) {
      setError(t("Выберите зал"));
      return;
    }
    try {
      const nextDate = scheduledDate.trim();
      const nextTime = scheduledTime.trim() || "00:00";
      const scheduledAt = nextDate ? toMskIsoString(nextDate, nextTime) : null;
      await createMatch({
        context_id: activeLobbyId ?? effectiveLobbyId ?? undefined,
        venue,
        scheduled_at: scheduledAt
      });
      const data = await fetchMatches({ limit: 30, offset: 0, context_id: activeLobbyId ?? effectiveLobbyId ?? undefined });
      setMatches(data?.matches || []);
      setHasMore(Boolean(data?.paging?.has_more));
      setNextOffset(data?.paging?.next_offset ?? null);
      setSheetOpen(false);
      setScheduledDate("");
      setScheduledTime("");
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="min-h-screen pb-10">
      <main className="mx-auto w-full max-w-md px-4 pt-4">
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3 flex-1">
              <h3 className="font-black italic text-sm uppercase tracking-tight text-[color:var(--text-main)] whitespace-nowrap">
                {t("Активные матчи")}
              </h3>
              <div className="flex-1 h-[2px] bg-[color:var(--border-main)]/10"></div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/lobbies")}
                className="w-10 h-10 bg-[var(--bg-surface)] text-[color:var(--text-main)] border-2 border-[var(--border-main)] rounded-lg flex items-center justify-center transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
                title={t("Лобби")}
              >
                <LayoutGrid className="h-5 w-5" strokeWidth={3} />
              </button>
              <button
                onClick={() => setSheetOpen(true)}
                className="w-10 h-10 bg-[var(--bg-contrast)] text-[color:var(--text-contrast)] border-2 border-[var(--border-main)] rounded-lg flex items-center justify-center transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                style={{ boxShadow: "4px 4px 0px 0px var(--border-main)" }}
                aria-label={t("Создать матч")}
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          </div>

          {error ? <StatusCard title={t("Ошибка")} message={error} onClose={() => setError(null)} /> : null}

          {loading ? (
            <div className="text-sm text-zinc-500">{t("Загрузка...")}</div>
          ) : activeMatches.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-[color:var(--border-main)]/10 rounded-[1.5rem] text-center text-zinc-500 font-bold uppercase text-[10px] tracking-widest bg-[var(--bg-surface)]">
              {t("Нет активных матчей")}
            </div>
          ) : (
            activeMatches.map((match) => <MatchCard key={match.id} match={match} />)
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-8">
            <h3 className="font-black italic text-sm uppercase tracking-tight text-zinc-400">
              {t("История матчей")}
            </h3>
            <div className="flex-1 h-[2px] bg-[color:var(--border-main)]/5"></div>
          </div>

          {finishedMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={async () => {
                if (nextOffset === null) return;
                setLoadingMore(true);
                try {
                  const data = await fetchMatches({ limit: 30, offset: nextOffset, context_id: activeLobbyId ?? undefined });
                  const items = data?.matches || [];
                  setMatches((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    const merged = [...prev];
                    for (const item of items) {
                      if (!seen.has(item.id)) merged.push(item);
                    }
                    return merged;
                  });
                  setHasMore(Boolean(data?.paging?.has_more));
                  setNextOffset(data?.paging?.next_offset ?? null);
                } catch (err) {
                  setError(formatApiError(err));
                } finally {
                  setLoadingMore(false);
                }
              }}
              className="mt-4 w-full h-10 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform disabled:opacity-50"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
            >
              {loadingMore ? t("Загрузка...") : t("Показать еще")}
            </button>
          ) : null}
        </section>
      </main>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="rounded-t-[1.75rem] border-t-2 border-[var(--border-main)] bg-[var(--bg-page)] p-0">
          <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-3 pb-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10" />
              <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{t("Create")}</div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="h-10 w-10 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  X
                </button>
              </SheetClose>
            </div>

            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t("Выбор зала")}</div>
              <div className="mt-3 flex flex-col gap-2">
                {venuesLoading ? (
                  <div className="text-xs font-bold uppercase tracking-widest opacity-50">
                    Загрузка площадок...
                  </div>
                ) : lobbyVenueOptions.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed px-4 py-3 text-xs font-bold uppercase tracking-widest opacity-60">
                    Нет площадок. Добавьте их в настройках лобби.
                  </div>
                ) : (
                  lobbyVenueOptions.map((option) => {
                    const active = venue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setVenue(option.value)}
                        className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-transform active:scale-[0.99] ${
                          active ? "bg-[var(--bg-contrast)] text-[color:var(--text-contrast)]" : "bg-[var(--bg-page)]"
                        }`}
                        style={{ borderColor: "var(--border-main)", color: active ? undefined : "var(--text-main)" }}
                      >
                        <span className="text-sm font-black uppercase tracking-widest">{option.label}</span>
                        {active ? (
                          <div className="h-6 w-6 rounded-lg bg-[var(--bg-page)] flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div
              className="rounded-[1.25rem] border-2 p-4"
              style={{ borderColor: "var(--border-main)", background: "var(--bg-surface)", color: "var(--text-main)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t("Дата и время")}</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="w-full bg-transparent border-0 px-0 text-base font-black uppercase tracking-tight text-current placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Дата"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  className="w-full bg-transparent border-0 px-0 text-base font-black uppercase tracking-tight text-current placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Время"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SheetClose asChild>
                <button
                  type="button"
                  className="h-10 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
                  style={{ borderColor: "var(--border-main)", background: "var(--bg-page)", color: "var(--text-main)" }}
                >
                  {t("Отмена")}
                </button>
              </SheetClose>
              <button
                onClick={handleCreate}
                disabled={venuesLoading || lobbyVenueOptions.length === 0}
                className="h-10 rounded-xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform"
                style={{
                  background: venuesLoading || lobbyVenueOptions.length === 0 ? "var(--bg-surface)" : "var(--bg-contrast)",
                  color: venuesLoading || lobbyVenueOptions.length === 0 ? "var(--text-main)" : "var(--text-contrast)",
                  opacity: venuesLoading || lobbyVenueOptions.length === 0 ? 0.5 : 1
                }}
              >
                {t("Создать матч")}
              </button>
            </div>
          </main>
        </SheetContent>
      </Sheet>
    </div>
  );
}
