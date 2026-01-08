import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
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

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
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
        <div className="min-w-0 flex-1 text-center text-sm font-semibold tracking-tight text-foreground">
          <span className="block truncate">{title || "WebFut"}</span>
        </div>
        <button type="button" onClick={() => navigate("/profile")} aria-label="Профиль">
          <Avatar className="h-9 w-9 border border-border">
            {avatarUrl ? <AvatarImage src={resolveMediaUrl(avatarUrl)} /> : null}
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
