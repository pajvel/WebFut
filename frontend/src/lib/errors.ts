import { ApiError } from "./api";

export function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      const code = error.data?.error;
      if (code === "init_data_missing") {
        return "Нет initData. Открой WebApp из Telegram.";
      }
      if (code === "hash_missing") {
        return "initData без hash. Перезапусти WebApp.";
      }
      if (code === "hash_mismatch") {
        return "initData не совпадает с токеном бота. Проверь TELEGRAM_BOT_TOKEN.";
      }
      if (code === "user_missing") {
        return "initData без user. Перезапусти WebApp.";
      }
      return "Сессия истекла. Перезапусти WebApp.";
    }
    if (error.status === 403) {
      const code = error.data?.error;
      if (code === "feedback_closed") {
        return "Время для фидбека истекло (72 часа после матча).";
      }
      return "Недостаточно прав для действия.";
    }
    if (error.status === 404) return "Данные не найдены.";
  }
  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Нет связи с сервером.";
    }
    return error.message;
  }
  return "Неизвестная ошибка";
}


