import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { resolveMediaUrl } from "../lib/media";
import { useMatText } from "../lib/mode18";

export type GoalPayload = {
  scorer_tg_id: number;
  assist_tg_id?: number | null;
};

type PlayerOption = {
  tg_id: number;
  name: string;
  avatar?: string | null;
};

export function GoalModal({
  open,
  onOpenChange,
  players,
  onSubmit,
  onOwnGoal,
  initialScorer,
  initialAssist
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PlayerOption[];
  onSubmit: (payload: GoalPayload) => void;
  onOwnGoal: () => void;
  initialScorer?: number | null;
  initialAssist?: number | null;
}) {
  const t = useMatText();
  const [scorer, setScorer] = useState<number | null>(null);
  const [assist, setAssist] = useState<number | null>(null);

  const options = useMemo(() => players, [players]);
  const assistOptions = useMemo(
    () => options.filter((player) => player.tg_id !== scorer),
    [options, scorer]
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScorer(initialScorer || null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssist(initialAssist || null);
  }, [open, initialScorer, initialAssist]);

  const handleSubmit = () => {
    if (!scorer) return;
    onSubmit({ scorer_tg_id: scorer, assist_tg_id: assist });
    setScorer(null);
    setAssist(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Гол")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Бомбардир")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {options.map((player) => (
                <button
                  key={player.tg_id}
                  type="button"
                  onClick={() => setScorer(player.tg_id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    scorer === player.tg_id ? "border-primary" : "border-border/60"
                  }`}
                >
                  <Avatar className="h-7 w-7 border border-border">
                    {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                    <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {player.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Ассист")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {assistOptions.map((player) => (
                <button
                  key={`assist-${player.tg_id}`}
                  type="button"
                  onClick={() => setAssist(player.tg_id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    assist === player.tg_id ? "border-secondary" : "border-border/60"
                  }`}
                >
                  <Avatar className="h-7 w-7 border border-border">
                    {player.avatar ? <AvatarImage src={resolveMediaUrl(player.avatar)} /> : null}
                    <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {player.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Button className="w-full" onClick={handleSubmit}>
              Подтвердить
            </Button>
            <Button variant="secondary" className="w-full" onClick={onOwnGoal}>
              Автогол
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


