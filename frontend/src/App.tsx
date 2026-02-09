import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { BootSplash } from "./components/BootSplash";
import { TopBar } from "./components/TopBar";
import { ensureTelegramAuth } from "./lib/auth";
import { getMe, getSettings, patchSettings, ApiError, fetchMatches, getProfile, getLeaderboard } from "./lib/api";
import { AppContext } from "./lib/app-context";
import type { Me, Settings } from "./lib/types";
import { formatApiError } from "./lib/errors";
import { PROFILE_THEMES, applyProfileTheme } from "./lib/profile-theme";

export default function App() {
  const MIN_BOOT_MS = 3000;
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStage, setBootStage] = useState("Initializing");
  const [canFastFinishBoot, setCanFastFinishBoot] = useState(false);
  const location = useLocation();
  const isProfile = location.pathname === "/profile";
  const isAdmin = location.pathname.startsWith("/admin");

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
    let cancelled = false;
    const bootStartedAt = Date.now();
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let waitTimer: ReturnType<typeof setTimeout> | null = null;

    const setBootStep = (progress: number, stage: string) => {
      if (cancelled) return;
      setBootProgress(progress);
      setBootStage(stage);
    };

    const finishBootNow = () => {
      if (cancelled) return;
      setCanFastFinishBoot(false);
      setBootStep(100, "Ready");
      hideTimer = setTimeout(() => {
        if (!cancelled) setIsBooting(false);
      }, 220);
    };

    const boot = async () => {
      let unauthorized = false;
      setBootStep(8, "Telegram Auth");
      try {
        await ensureTelegramAuth();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(formatApiError(err));
          unauthorized = true;
          return;
        }
      }

      setBootStep(24, "Loading Profile");
      await getMe()
        .then((data) => {
          if (!cancelled) setMe(data);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            setAuthError(formatApiError(err));
            unauthorized = true;
          }
        });

      if (cancelled || unauthorized) return;

      setBootStep(38, "Loading Theme");
      await getSettings()
        .then((data) => {
          if (!cancelled) setSettings(data);
        })
        .catch(() => undefined);

      setBootStep(58, "Loading Matches");
      await fetchMatches().catch(() => undefined);

      setBootStep(76, "Loading Rating");
      await getProfile().catch(() => undefined);

      setBootStep(92, "Loading Leaderboard");
      await getLeaderboard().catch(() => undefined);

      if (cancelled) return;
      const elapsed = Date.now() - bootStartedAt;
      if (elapsed >= MIN_BOOT_MS) {
        finishBootNow();
        return;
      }

      setBootStep(96, "Loaded. Tap to finish");
      setCanFastFinishBoot(true);
      waitTimer = setTimeout(() => {
        finishBootNow();
      }, MIN_BOOT_MS - elapsed);
    };

    void boot();
    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
      if (waitTimer) clearTimeout(waitTimer);
    };
  }, [refreshMe]);

  useEffect(() => {
    const storedThemeId = localStorage.getItem("profile_theme");
    applyProfileTheme(storedThemeId);
  }, []);

  useEffect(() => {
    if (settings?.theme) {
      const themeRaw = String(settings.theme);
      const mappedTheme =
        themeRaw === "light"
          ? "real"
          : themeRaw === "dark"
            ? "juve"
            : themeRaw;
      const isKnownProfileTheme = PROFILE_THEMES.some((theme) => theme.id === mappedTheme);
      if (isKnownProfileTheme) {
        applyProfileTheme(mappedTheme);
      }
      document.documentElement.classList.toggle("dark", mappedTheme === "juve");
    }
    document.documentElement.classList.toggle("avatars-grayscale", settings?.avatar_grayscale !== false);
  }, [settings?.theme, settings?.avatar_grayscale]);

  const setTheme = useCallback((theme: string) => {
    patchSettings({ theme }).then(() => {
      setSettings((prev) =>
        prev ? { ...prev, theme } : { theme, mode_18plus: false, avatar_grayscale: true }
      );
      const mappedTheme = theme === "light" ? "real" : theme === "dark" ? "juve" : theme;
      const isKnownProfileTheme = PROFILE_THEMES.some((item) => item.id === mappedTheme);
      if (isKnownProfileTheme) {
        applyProfileTheme(mappedTheme);
      }
      document.documentElement.classList.toggle("dark", mappedTheme === "juve");
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
      {isBooting ? (
        <BootSplash
          progress={bootProgress}
          stage={bootStage}
          canFastFinish={canFastFinishBoot}
          onFastFinish={() => {
            if (!canFastFinishBoot) return;
            setCanFastFinishBoot(false);
            setBootProgress(100);
            setBootStage("Ready");
            setTimeout(() => setIsBooting(false), 220);
          }}
        />
      ) : null}
      <div className="min-h-screen">
        <TopBar title="WebFut" avatarUrl={me?.custom_avatar || me?.tg_avatar || null} />
        <main
          className={
            isProfile || isAdmin
              ? "mx-auto w-full max-w-none px-0 pb-0 pt-0"
              : "mx-auto w-full max-w-md px-4 pb-2 pt-0"
          }
        >
          <Outlet />
        </main>
      </div>
    </AppContext.Provider>
  );
}
