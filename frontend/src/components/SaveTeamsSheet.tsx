import { useState } from "react";

import { Shuffle } from "lucide-react";
import { Sheet, SheetContent } from "./ui/sheet";
import { useMatText } from "../lib/mode18";

export function SaveTeamsSheet({
  open,
  onOpenChange,
  onStart
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (teamA: string, teamB: string) => void;
}) {
  const t = useMatText();
  const [teamA, setTeamA] = useState("Команда A");
  const [teamB, setTeamB] = useState("Команда B");
  const names = [
    "Пантеры",
    "Торнадо",
    "Рейнджеры",
    "Ястребы",
    "Титаны",
    "Гладиаторы",
    "Самураи",
    "Кобры",
    "Спартанцы",
    "Викинги",
    "Комета",
    "Шторм",
    "Соколы",
    "Метеор",
    "Скорпионы"
  ];
  const randomName = () => names[Math.floor(Math.random() * names.length)];
  const randomizeBoth = () => {
    let a = randomName();
    let b = randomName();
    if (a === b) b = randomName();
    setTeamA(a);
    setTeamB(b);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[var(--bg-surface)] border-l-4 border-[var(--border-main)] text-[var(--text-main)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black italic uppercase text-lg leading-none">Confirm Squads</h3>
            <button
              onClick={randomizeBoth}
              className="flex items-center gap-2 px-2 py-1 rounded-lg border-2 border-[var(--border-main)] font-black text-[9px] uppercase tracking-widest"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Random
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-60">Team A</label>
            <div className="flex items-center gap-2">
              <input
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                placeholder={t("Команда A")}
                className="flex-1 h-12 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-page)] px-3 font-black uppercase tracking-tight text-sm"
              />
              <button
                onClick={() => setTeamA(randomName())}
                className="h-12 w-12 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center"
                aria-label="Random team A"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest opacity-60">Team B</label>
            <div className="flex items-center gap-2">
              <input
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                placeholder={t("Команда B")}
                className="flex-1 h-12 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-page)] px-3 font-black uppercase tracking-tight text-sm"
              />
              <button
                onClick={() => setTeamB(randomName())}
                className="h-12 w-12 rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center"
                aria-label="Random team B"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-4 font-black italic uppercase text-sm shadow-[6px_6px_0px_0px_var(--border-main)] border-2 border-[var(--border-main)] active:shadow-none transition-all"
              onClick={() => onStart(teamA, teamB)}
            >
              Start Match
            </button>
            <button
              className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] py-3 font-black uppercase text-[10px]"
              onClick={() => onOpenChange(false)}
            >
              Back
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


