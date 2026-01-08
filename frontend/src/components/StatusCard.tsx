import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "./ui/card";
import { useMatText } from "../lib/mode18";

export function StatusCard({ title, message }: { title: string; message: string }) {
  const t = useMatText();
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <div className="mt-1 rounded-full bg-destructive/10 p-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{t(title)}</div>
          <div className="text-xs text-muted-foreground">{t(message)}</div>
        </div>
      </CardContent>
    </Card>
  );
}



