const MSK_TIMEZONE = "Europe/Moscow";

function extractNaiveParts(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4],
    minute: m[5]
  };
}

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateShortMsk(value: string | null) {
  if (!value) return "";
  const naive = extractNaiveParts(value);
  if (naive) {
    return new Date(naive.year, naive.month - 1, naive.day).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short"
    });
  }
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: MSK_TIMEZONE
  }).format(date);
}

export function formatTimeMsk(value: string | null) {
  if (!value) return "";
  const naive = extractNaiveParts(value);
  if (naive) return `${naive.hour}:${naive.minute}`;
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: MSK_TIMEZONE
  }).format(date);
}

export function formatDateTimeMsk(value: string | null) {
  if (!value) return "";
  const d = formatDateShortMsk(value);
  const t = formatTimeMsk(value);
  return d && t ? `${d} ${t}` : d || t;
}

export function nowMskParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MSK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`
  };
}

export function toMskIsoString(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue}:00+03:00`;
}

