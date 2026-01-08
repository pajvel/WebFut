import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getMatch, getUserProfile } from "../lib/api";
import type { MatchDetail, ProfileHistoryItem, ProfileStats } from "../lib/types";
import { MatchCard } from "../components/MatchCard";
import { StatusCard } from "../components/StatusCard";
import { Card, CardContent } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { resolveMediaUrl } from "../lib/media";
import { formatApiError } from "../lib/errors";
import { useMatText } from "../lib/mode18";

const emptyStats: ProfileStats = {
  matches: 0,
  wins: 0,
  losses: 0,
  goals: 0,
  assists: 0,
  mvp: 0
};

export function PlayerProfile() {
  const { tgId, matchId } = useParams();
  const navigate = useNavigate();
  const t = useMatText();
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [player, setPlayer] = useState<{ name: string; avatar?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tgId) return;
    getUserProfile(Number(tgId))
      .then((data) => {
        setStats(data?.stats || emptyStats);
        setHistory(data?.history || []);
      })
      .catch((err) => setError(formatApiError(err)));
  }, [tgId]);

  useEffect(() => {
    if (!matchId || !tgId) return;
    getMatch(Number(matchId))
      .then((data: MatchDetail) => {
        const member = data.members.find((m) => String(m.tg_id) === String(tgId));
        if (member) setPlayer({ name: member.name, avatar: member.avatar });
      })
      .catch(() => undefined);
  }, [matchId, tgId]);

  const latestHistory = useMemo(() => history.slice(0, 5), [history]);

  if (error) {
    return <StatusCard title={t("Ошибка")} message={error} />;
  }

  if (!tgId) {
    return <StatusCard title={t("Ошибка")} message={t("Игрок не найден")} />;
  }

  const displayName = player?.name || `ID ${tgId}`;
  const avatarSrc = player?.avatar ? resolveMediaUrl(player.avatar) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {avatarSrc ? <AvatarImage src={avatarSrc} /> : null}
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{displayName}</div>
            <div className="truncate text-xs text-muted-foreground">ID: {tgId}</div>
          </div>
          {matchId ? (
            <button
              type="button"
              onClick={() => navigate(`/matches/${matchId}/finished`)}
              className="text-xs text-muted-foreground"
            >
              {t("Назад к матчу")}
            </button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">{t("Статистика")}</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Матчи", value: stats.matches },
              { label: "Победы", value: stats.wins },
              { label: "Поражения", value: stats.losses },
              { label: "Голы", value: stats.goals },
              { label: "Ассисты", value: stats.assists },
              { label: "MVP", value: stats.mvp }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <div className="text-lg font-semibold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{t(item.label)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="text-sm font-semibold">{t("История матчей")}</div>
        <div className="space-y-3">
          {latestHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("Пока нет матчей")}</div>
          ) : (
            latestHistory.map((match) => <MatchCard key={match.id} match={match} />)
          )}
        </div>
      </div>
    </div>
  );
}
