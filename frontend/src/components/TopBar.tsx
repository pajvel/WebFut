import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { resolveMediaUrl } from "../lib/media";
import { cn } from "../lib/utils";

type TopBarProps = {
  title?: string;
  avatarUrl?: string | null;
};

const rootPaths = new Set(["/", "/matches"]);

export function TopBar({ title, avatarUrl }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = !rootPaths.has(location.pathname);
  const [changesOpen, setChangesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-lg">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex w-20 items-center justify-start">
          {canGoBack ? (
            <button
              type="button"
              onClick={() => navigate("/matches")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition",
                canGoBack ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              aria-label="Назад"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setChangesOpen(true)}
              className="flex h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition"
              aria-label="Изменения"
            >
              Изменения
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1 text-center text-sm font-semibold tracking-tight text-foreground">
          <span className="block truncate">{title || "WebFut"}</span>
        </div>
        <div className="flex w-20 items-center justify-end">
          <button type="button" onClick={() => navigate("/profile")} aria-label="Профиль">
            <Avatar className="h-9 w-9 border border-border">
              {avatarUrl ? <AvatarImage src={resolveMediaUrl(avatarUrl)} /> : null}
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto touch-pan-y">
          <DialogHeader>
            <DialogTitle>Изменения</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                v0.75.1
              </div>
              <div>• Выбор игроков в фидбеке теперь с аватарками.</div>
              <div>• Сравнения в фидбеке генерируются индивидуально для каждого игрока.</div>
              <div>• Добавлено отожражение рейтинга в профиле.</div>
              <div>• Лидерборд по глобальному рейтингу добавлен в профиль (пьедестал + таблица).</div>
              <div>• Мелкие косметические изменения.</div>
            </div>
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                v0.75
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Главное
                </div>
                <div>• Исправлено создание матча с датой (раньше иногда ломалось).</div>
                <div>• Ассисты теперь учитываются в рейтинге.</div>
                <div>• При равных голосах MVP выбирается по голам+ассистам, потом по голам.</div>
                <div>• Зритель может добавлять события (голы).</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Составы
                </div>
                <div>• Выбор вариантов больше не сбрасывается сам.</div>
                <div>• Кастомные составы реально сохраняются.</div>
                <div>• Счетчики игроков обновляются после перетаскивания.</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Финал матча
                </div>
                <div>• В событиях видно, кто забил и кто отдал пас.</div>
                <div>• События оформлены карточками с аватарами и счетом.</div>
                <div>• MVP вынесен во вкладку “Лучшие”.</div>
                <div>• Линия MVP + “худший” + корона + стеки равных.</div>
                <div>• Табы выровнены: “Итог” по центру.</div>
                <div>• Пьедесталы топ‑3 (гол+пас, голы, ассисты).</div>
                <div>• Фильтр пьедесталов: общая / команда A / команда B.</div>
                <div>• Все аватары кликабельны (переход к игроку).</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Режим 18+
                </div>
                <div>• Обновлены тексты в MVP/“Лучших”/подсказках.</div>
                <div>• Текст табов не вылезает за кнопки.</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
