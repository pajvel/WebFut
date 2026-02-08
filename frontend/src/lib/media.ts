const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export function resolveMediaUrl(path?: string | null) {
  if (!path) return "";
  const normalized = path.replace(/\\\//g, "/");
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  if (!API_BASE_URL) {
    return normalized;
  }
  const base = API_BASE_URL.replace(/\/$/, "");
  const suffix = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${base}${suffix}`;
}
