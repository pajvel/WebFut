import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "./ui/card";
import type { MatchParticipant } from "../lib/types";
import { AvatarStack } from "./AvatarStack";
import { useMatText } from "../lib/mode18";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

type MatchCardItem = {
  id: number;
  scheduled_at: string | null;
  venue: string;
  status: "created" | "live" | "finished";
  created_at: string;
  finished_at: string | null;
  score_a: number;
  score_b: number;
  team_a_members: MatchParticipant[];
  team_b_members: MatchParticipant[];
};

const statusLabel: Record<MatchCardItem["status"], string> = {
  created: "Ожидает",
  live: "В процессе",
  finished: "Завершен"
};

export function MatchCard({ match }: { match: MatchCardItem }) {
  const t = useMatText();
  const teamA = match.team_a_members || [];
  const teamB = match.team_b_members || [];
  const target =
    match.status === "finished"
      ? `/matches/${match.id}/finished`
      : match.status === "live"
        ? `/matches/${match.id}/live`
        : `/matches/${match.id}`;

  return (
    <Link to={target}>
      <Card className="transition hover:-translate-y-0.5 hover:border-primary/40">
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0 overflow-hidden">
              <AvatarStack
                users={teamA.map((m) => ({ name: m.name, avatar: m.avatar }))}
                size="md-sm"
                max={5}
                className="pr-2"
              />
            </div>
            <div className="text-center bg-transparent px-1">
              <div className="text-lg font-semibold">
                {match.score_a} : {match.score_b}
              </div>
            </div>
            <div className="min-w-0 overflow-hidden">
              <AvatarStack
                users={teamB.map((m) => ({ name: m.name, avatar: m.avatar }))}
                size="md-sm"
                max={5}
                className="justify-end pl-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="truncate">{formatDate(match.scheduled_at || match.created_at)}</span>
            </div>
            <div className="text-center">{t(statusLabel[match.status])}</div>
            <div className="flex min-w-0 items-center gap-2 justify-end">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{match.venue}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
