import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { getMatch, getUserProfile } from "../lib/api";
import type { MatchDetail, ProfileHistoryItem, ProfileRating, ProfileStats } from "../lib/types";
import { StatusCard } from "../components/StatusCard";
import { resolveMediaUrl } from "../lib/media";
import { formatApiError } from "../lib/errors";
import { buildProfileMatch, MatchesList, ProfileCard, StatsGrid } from "./Profile";

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
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [rating, setRating] = useState<ProfileRating | null>(null);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [player, setPlayer] = useState<{ name: string; avatar?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotFound, setShowNotFound] = useState(true);

  useEffect(() => {
    if (!tgId) return;
    getUserProfile(Number(tgId))
      .then((data) => {
        setStats(data?.stats || emptyStats);
        setRating(data?.rating || null);
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

  const orderedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const aDate = new Date(a.finished_at || a.scheduled_at || a.created_at).getTime();
      const bDate = new Date(b.finished_at || b.scheduled_at || b.created_at).getTime();
      return bDate - aDate;
    });
  }, [history]);

  const profileMatches = useMemo(
    () => orderedHistory.map((match) => buildProfileMatch(match, tgId ? Number(tgId) : null)),
    [orderedHistory, tgId]
  );

  const latestMatches = useMemo(() => profileMatches.slice(0, 6), [profileMatches]);
  const ratingValue = useMemo(() => {
    if (!rating || Number.isNaN(rating.global)) return null;
    return rating.global;
  }, [rating]);
  const ratingDelta = rating?.last_delta ?? null;

  const errorToast = error ? <StatusCard title="Ошибка" message={error} onClose={() => setError(null)} /> : null;
  const notFoundToast = showNotFound && !tgId ? (
    <StatusCard title="Ошибка" message="Игрок не найден" onClose={() => setShowNotFound(false)} />
  ) : null;

  if (!tgId) {
    return (
      <>
        {errorToast}
        {notFoundToast}
        <div
          className="min-h-screen"
          style={{ fontFamily: "Inter, sans-serif", background: "var(--bg-page, #050505)", color: "var(--text-main, #ffffff)" }}
        />
      </>
    );
  }

  const displayName = (player?.name || "PLAYER").toUpperCase();
  const avatarSrc = player?.avatar ? resolveMediaUrl(player.avatar) : null;

  return (
    <>
      {errorToast}
      <div
      className="min-h-screen pb-10"
      style={{ fontFamily: "Inter, sans-serif", background: "var(--bg-page, #050505)", color: "var(--text-main, #ffffff)" }}
    >
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-2">
        <ProfileCard
          name={displayName}
          avatarUrl={avatarSrc}
          rating={ratingValue}
          ratingDelta={ratingDelta}
          badgeLabel="PLAYER"
        />

        <StatsGrid stats={stats} />
        <MatchesList matches={latestMatches} history={orderedHistory} />
      </main>
      </div>
    </>
  );
}

