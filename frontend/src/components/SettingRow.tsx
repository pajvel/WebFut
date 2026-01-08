import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export function SettingRow({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-left shadow-soft",
        onClick ? "transition hover:border-primary/40" : "cursor-default"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {description ? (
            <div className="truncate text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      {onClick ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
    </button>
  );
}



