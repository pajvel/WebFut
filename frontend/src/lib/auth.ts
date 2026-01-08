import { authTelegram } from "./api";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function getTelegramInitData() {
  const initData = window.Telegram?.WebApp?.initData || "";
  return initData;
}

export function storeInitData(initData: string) {
  if (initData) {
    localStorage.setItem("tg_init_data", initData);
  }
}

export function getStoredInitData() {
  return localStorage.getItem("tg_init_data") || "";
}

export function storeToken(token: string) {
  if (token) {
    localStorage.setItem("auth_token", token);
  }
}

export async function ensureTelegramAuth() {
  const initData = getTelegramInitData() || getStoredInitData();
  
  console.log("[AUTH] initData length:", initData.length);
  console.log("[AUTH] initData preview:", initData.substring(0, 100));
  
  if (!initData) {
    console.log("[AUTH] No initData available");
    return;
  }

  storeInitData(initData);

  try {
    console.log("[AUTH] Calling authTelegram...");
    const result = await authTelegram(initData);
    console.log("[AUTH] Auth successful:", result);
    if (result?.token) {
      storeToken(result.token);
    }
    if (window.Telegram?.WebApp?.ready) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand?.();
    }
  } catch (err) {
    console.error("[AUTH ERROR]", err);
    throw err;
  }
}



