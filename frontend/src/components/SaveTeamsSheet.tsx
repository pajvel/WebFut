import { useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("Сохранить команды")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <Input
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            placeholder={t("Команда A")}
          />
          <Input
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            placeholder={t("Команда B")}
          />
          <div className="space-y-2">
            <Button className="w-full" onClick={() => onStart(teamA, teamB)}>
              Начать матч
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Вернуться
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}



