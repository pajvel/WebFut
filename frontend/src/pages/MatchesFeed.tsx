import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

import { createMatch, fetchMatches } from "../lib/api";
import type { MatchSummary } from "../lib/types";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { MatchCard } from "../components/MatchCard";
import { StatusCard } from "../components/StatusCard";
import { formatApiError } from "../lib/errors";
import { useMatText } from "../lib/mode18";

const containerMotion = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

const venueOptions = [
  { value: "зал1", label: "Эксперт" },
  { value: "зал2", label: "Маракана" }
];

export function MatchesFeed() {
  const t = useMatText();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [venue, setVenue] = useState(venueOptions[0].value);
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    fetchMatches()
      .then((data) => setMatches(data?.matches || []))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

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
      await createMatch({
        venue,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
      });
      const data = await fetchMatches();
      setMatches(data?.matches || []);
      setSheetOpen(false);
      setScheduledAt("");
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("Матчи")}</h1>
          <p className="text-sm text-muted-foreground">{t("Активные сверху, история ниже")}</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("Создать")}
        </Button>
      </div>

      {error ? <StatusCard title={t("Ошибка")} message={error} /> : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>
      ) : error ? null : (
        <motion.div variants={containerMotion} initial="hidden" animate="show" className="space-y-4">
          {activeMatches.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("Нет активных матчей")}</div>
          ) : (
            activeMatches.map((match) => (
              <motion.div key={match.id} variants={itemMotion}>
                <MatchCard match={match} />
              </motion.div>
            ))
          )}

          {finishedMatches.length > 0 ? (
            <div className="pt-2">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("История")}
              </div>
              <div className="space-y-3">
                {finishedMatches.map((match) => (
                  <motion.div key={match.id} variants={itemMotion}>
                    <MatchCard match={match} />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("Новый матч")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("Выбор зала")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {venueOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVenue(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      venue === option.value ? "border-primary bg-primary/15" : "border-border/60 bg-card/70"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="flex h-11 w-full rounded-lg border border-input bg-card/70 px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button onClick={handleCreate} className="w-full">
              {t("Создать матч")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
