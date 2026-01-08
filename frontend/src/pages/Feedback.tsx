import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { getMatch, submitFeedback } from "../lib/api";
import type { MatchDetail, MatchMember } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { formatApiError } from "../lib/errors";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { StatusCard } from "../components/StatusCard";
import { useMatText } from "../lib/mode18";

export function Feedback() {
  const { matchId } = useParams();
  const { settings } = useAppContext();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MatchMember | null>(null);
  const [comparison, setComparison] = useState<{ left?: MatchMember; right?: MatchMember }>({});

  useEffect(() => {
    if (!matchId) return;
    getMatch(Number(matchId))
      .then(setData)
      .catch((err) => setError(formatApiError(err)));
  }, [matchId]);

  const players = useMemo(() => {
    return data?.members.filter((m) => m.role !== "spectator") || [];
  }, [data]);

  const mode18 = settings?.mode_18plus;

  const handleSubmit = async () => {
    if (!matchId) return;
    try {
      await submitFeedback(Number(matchId), {
        answers_json: {
          quick: {
            best: selectedPlayer?.tg_id || null,
            compare_left: comparison.left?.tg_id || null,
            compare_right: comparison.right?.tg_id || null
          },
          mode_18plus: mode18
        },
        mvp_vote_tg_id: selectedPlayer?.tg_id || null
      });
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  if (error) {
    return <StatusCard title={t("Ошибка")} message={error} />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("Фидбек")}</h1>
        <p className="text-sm text-muted-foreground">
          {mode18 ? t("Режим 18+ активен") : t("Быстрый фидбек по матчу")}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">
            {mode18 ? t("Кто сегодня отжигал сильнее всех?") : t("Лучший игрок матча")}
          </div>
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            {selectedPlayer ? selectedPlayer.name : t("Выбрать игрока")}
          </Button>
          <Button onClick={() => setAdvancedOpen(true)} variant="secondary">
            {t("Расширенный")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">{t("Сравнение игроков")}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setComparison({ ...comparison, left: players[0] })}>
              {comparison.left?.name || t("Этот")}
            </Button>
            <Button variant="outline" onClick={() => setComparison({ ...comparison, right: players[1] })}>
              {comparison.right?.name || t("Этот")}
            </Button>
          </div>
          <Button onClick={handleSubmit} className="w-full">
            {t("Отправить")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Выбор игрока")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {players.map((player) => (
              <button
                key={player.tg_id}
                type="button"
                onClick={() => {
                  setSelectedPlayer(player);
                  setPickerOpen(false);
                }}
                className="rounded-xl border border-border/60 px-3 py-2 text-sm text-left"
              >
                {player.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Расширенный фидбек")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline">{t("Все игроки")}</Button>
            <Button variant="outline">{t("Своя команда")}</Button>
            <Button variant="outline">{t("Команда соперника")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



