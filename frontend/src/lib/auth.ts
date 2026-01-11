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
  if (initData) {
    return initData;
  }
  
  // DEV MODE: если нет Telegram WebApp, используем сохраненные тестовые данные
  const devInitData = localStorage.getItem("tg_init_data");
  if (devInitData) {
    return devInitData;
  }
  
  // Если нет ничего, возвращаем пустую строку
  // Админские данные должны устанавливаться вручную для тестов
  return "";
}

export function storeInitData(initData: string) {
  if (initData) {
    localStorage.setItem("tg_init_data", initData);
  }
}

export function getStoredInitData() {
  return localStorage.getItem("tg_init_data") || "";
}

// Функция для ручной установки DEV данных (для тестов)
export function setDevAuthData(tgId: number = 963047320, firstName: string = "Я") {
  const devData = `user=%7B%22id%22%3A${tgId}%2C%22first_name%22%3A%22${encodeURIComponent(firstName)}%22%7D`;
  localStorage.setItem("tg_init_data", devData);
  return devData;
}

export function storeToken(token: string) {
  if (token) {
    localStorage.setItem("auth_token", token);
  }
}

export async function ensureTelegramAuth() {
  const initData = getTelegramInitData() || getStoredInitData();
  
  if (import.meta.env.DEV) {
    console.log("[AUTH] initData length:", initData.length);
    console.log("[AUTH] initData preview:", initData.substring(0, 100));
  }
  
  if (!initData) {
    if (import.meta.env.DEV) {
      console.log("[AUTH] No initData available");
    }
    return;
  }

  storeInitData(initData);

  try {
    if (import.meta.env.DEV) {
      console.log("[AUTH] Calling authTelegram...");
    }
    const result = await authTelegram(initData);
    if (import.meta.env.DEV) {
      console.log("[AUTH] Auth successful:", result);
    }
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



