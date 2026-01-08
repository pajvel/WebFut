import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { TopBar } from "./components/TopBar";
import { ensureTelegramAuth } from "./lib/auth";
import { getMe, getSettings, patchSettings } from "./lib/api";
import { AppContext } from "./lib/app-context";
import type { Me, Settings } from "./lib/types";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const refreshMe = useCallback(() => {
    getMe().then(setMe).catch(() => undefined);
    getSettings().then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    ensureTelegramAuth().finally(refreshMe);
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
