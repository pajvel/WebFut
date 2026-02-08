import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent } from "./ui/dialog";
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
    setScorer(initialScorer ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssist(initialAssist ?? null);
  }, [open, initialScorer, initialAssist]);

  const handleSubmit = (assistOverride?: number | null) => {
    if (!scorer) return;
    const effectiveAssist = assistOverride === undefined ? assist : assistOverride;
    onSubmit({ scorer_tg_id: scorer, assist_tg_id: effectiveAssist });
    setScorer(null);
    setAssist(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6 shadow-[4px_4px_0px_0px_var(--border-main)]">
        <div className="text-center mb-6">
          <h2 className="text-[var(--text-main)] text-3xl font-black italic uppercase tracking-tighter leading-none">
            GOAL ASSIST?
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[var(--text-main)] text-[10px] font-bold uppercase tracking-widest opacity-60">
              SCORER:
            </span>
            <span className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-[var(--border-main)]">
              {options.find((p) => p.tg_id === scorer)?.name || t("Выберите")}
            </span>
          </div>
        </div>

        {scorer ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setScorer(null)}
              className="col-span-2 h-10 rounded-lg border-2 border-[var(--border-main)] text-[9px] font-black uppercase tracking-widest"
              style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
            >
              CHANGE SCORER
            </button>
            {assistOptions.map((player) => (
              <button
                key={`assist-${player.tg_id}`}
                onClick={() => handleSubmit(player.tg_id)}
                className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-[var(--bg-contrast)] group"
              >
                {player.avatar ? (
                  <img
                    src={resolveMediaUrl(player.avatar)}
                    className="w-10 h-10 rounded-lg grayscale border border-[var(--border-main)] group-hover:grayscale-0 transition-all object-cover"
                    alt={player.name}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center text-[10px] font-black border border-[var(--border-main)]">
                    {player.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-[var(--text-main)] group-hover:text-[var(--text-contrast)] text-[10px] font-black uppercase tracking-widest truncate w-full text-center transition-colors">
                  {player.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {options.map((player) => (
              <button
                key={`scorer-${player.tg_id}`}
                onClick={() => setScorer(player.tg_id)}
                className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-[var(--bg-contrast)] group"
              >
                {player.avatar ? (
                  <img
                    src={resolveMediaUrl(player.avatar)}
                    className="w-10 h-10 rounded-lg grayscale border border-[var(--border-main)] group-hover:grayscale-0 transition-all object-cover"
                    alt={player.name}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center text-[10px] font-black border border-[var(--border-main)]">
                    {player.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-[var(--text-main)] group-hover:text-[var(--text-contrast)] text-[10px] font-black uppercase tracking-widest truncate w-full text-center transition-colors">
                  {player.name}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleSubmit(null)}
            className="w-full h-14 bg-[var(--bg-contrast)] rounded-xl border-2 border-[var(--border-main)] flex items-center justify-center text-[var(--text-contrast)] font-black italic text-lg uppercase tracking-tighter active:scale-95 transition-transform shadow-sm"
          >
            NO ASSIST / SOLO
          </button>

          <button
            onClick={onOwnGoal}
            className="w-full h-10 bg-[#ef4444] rounded-lg border-2 border-[var(--border-main)] flex items-center justify-center text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
          >
            RECORD AS OWN GOAL
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            CANCEL ENTRY
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
