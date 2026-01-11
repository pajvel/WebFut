import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { TopBar } from "./components/TopBar";
import { ensureTelegramAuth } from "./lib/auth";
import { getMe, getSettings, patchSettings, ApiError } from "./lib/api";
import { AppContext } from "./lib/app-context";
import type { Me, Settings } from "./lib/types";
import { formatApiError } from "./lib/errors";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshMe = useCallback(() => {
    getMe()
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(formatApiError(err));
        }
      });
    getSettings().then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    ensureTelegramAuth()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(formatApiError(err));
        }
      })
      .finally(refreshMe);
  }, [refreshMe]);

  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
    }
  }, [settings?.theme]);

  const setTheme = useCallback((theme: "light" | "dark") => {
    patchSettings({ theme }).then(() => {
      setSettings((prev) => (prev ? { ...prev, theme } : { theme, mode_18plus: false }));
      document.documentElement.classList.toggle("dark", theme === "dark");
    });
  }, []);

  const contextValue = useMemo(
    () => ({ me, settings, setTheme, refreshMe }),
    [me, settings, setTheme, refreshMe]
  );

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card/70 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">Ошибка авторизации</h2>
          <p className="text-sm text-muted-foreground">{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen">
        <TopBar title="WebFut" avatarUrl={me?.custom_avatar || me?.tg_avatar || null} />
        <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
          <Outlet />
        </main>
      </div>
    </AppContext.Provider>
  );
}
