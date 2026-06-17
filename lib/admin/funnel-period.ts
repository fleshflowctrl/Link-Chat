export type FunnelPeriod = "1d" | "7d" | "14d" | "30d" | "live" | "all";

export const FUNNEL_PERIOD_OPTIONS: {
  value: FunnelPeriod;
  label: string;
}[] = [
  { value: "1d", label: "1d" },
  { value: "7d", label: "7d" },
  { value: "14d", label: "14d" },
  { value: "30d", label: "1 maand" },
  { value: "live", label: "Live" },
  { value: "all", label: "Totaal" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseFunnelPeriod(raw: string | undefined): FunnelPeriod {
  if (raw === "1d" || raw === "7d" || raw === "14d" || raw === "30d" || raw === "all") {
    return raw;
  }
  return "live";
}

export function resolveFunnelPeriodSince(
  period: FunnelPeriod,
  liveSince: string | null,
): string | null {
  const now = Date.now();
  switch (period) {
    case "1d":
      return new Date(now - DAY_MS).toISOString();
    case "7d":
      return new Date(now - 7 * DAY_MS).toISOString();
    case "14d":
      return new Date(now - 14 * DAY_MS).toISOString();
    case "30d":
      return new Date(now - 30 * DAY_MS).toISOString();
    case "all":
      return null;
    case "live":
      return liveSince;
  }
}

export function funnelPeriodDescription(
  period: FunnelPeriod,
  since: string | null,
  formatTs: (iso: string) => string,
): string {
  switch (period) {
    case "1d":
      return "Laatste 24 uur (v2).";
    case "7d":
      return "Laatste 7 dagen (v2).";
    case "14d":
      return "Laatste 14 dagen (v2).";
    case "30d":
      return "Laatste 30 dagen (v2).";
    case "all":
      return "All-time conversie van bezoeker tot betalende gebruiker (v2).";
    case "live":
      return since
        ? `Live-funnel telt vanaf ${formatTs(since)}.`
        : "Live-funnel — nog nooit gereset.";
  }
}
