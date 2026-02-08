import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { resolveMediaUrl } from "../lib/media";
import { cn } from "../lib/utils";

export function AvatarStack({
  users,
  size = "sm",
  className,
  max = 5
}: {
  users: { name: string; avatar?: string | null }[];
  size?: "sm" | "md" | "md-sm";
  className?: string;
  max?: number;
}) {
  const dimension =
    size === "sm" ? "h-7 w-7" : size === "md-sm" ? "h-8 w-8" : "h-9 w-9";
  const showOverflow = users.length > max;
  const visibleCount = showOverflow ? Math.max(0, max - 1) : users.length;
  const visible = users.slice(0, visibleCount);
  const remaining = users.length - visible.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((user, index) => (
        <Avatar key={`${user.name}-${index}`} className={`${dimension} border border-background`}>
          {user.avatar ? <AvatarImage src={resolveMediaUrl(user.avatar)} /> : null}
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
      {showOverflow && remaining > 0 ? (
        <Avatar className={`${dimension} border border-background`}>
          <AvatarFallback>+{remaining}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}
