import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { useMatText } from "../lib/mode18";

export function StatusCard({
  title,
  message,
  onClose
}: {
  title: string;
  message: string;
  onClose?: () => void;
}) {
  const t = useMatText();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-6"
      onClick={onClose}
      role="alert"
    >
      <Card
        className="w-full max-w-md border-0 bg-transparent shadow-none animate-in fade-in slide-in-from-bottom-4"
        onClick={(event) => event.stopPropagation()}
      >
        <CardContent className="p-0">
          <div className="relative w-full rounded-[28px] border-4 border-[var(--border-main)] bg-[var(--bg-surface)] p-6 shadow-[6px_6px_0px_0px_var(--border-main)]">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-main)]/50">
                  {t("Ошибка")}
                </div>
                <div className="mt-1 text-xl font-black italic uppercase leading-none text-[var(--text-main)]">
                  {t(title)}
                </div>
                <div className="mt-2 text-xs font-bold uppercase tracking-widest text-[var(--text-main)]/60">
                  {t(message)}
                </div>
              </div>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-[var(--text-main)] transition-transform active:scale-95"
                aria-label={t("Закрыть")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
