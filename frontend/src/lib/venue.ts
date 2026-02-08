const VENUE_LABELS: Record<string, string> = {
  "зал1": "Эксперт",
  "зал 1": "Эксперт",
  "эксперт": "Эксперт",
  "зал2": "Маракана",
  "зал 2": "Маракана",
  "маракана": "Маракана"
};

export function formatVenueLabel(raw: string | null | undefined) {
  if (!raw) return "—";
  const normalized = raw.trim().toLowerCase();
  return VENUE_LABELS[normalized] || raw;
}
