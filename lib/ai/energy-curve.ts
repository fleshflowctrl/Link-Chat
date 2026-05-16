/**
 * Energy curve over the day.
 *
 * Real people aren't equally bubbly all day. We model a simple energy/mood
 * arc per persona based on local hour-of-day, weekday vs weekend, and
 * (optionally) recent message density. The result is a tiny natural-language
 * hint injected into the system prompt, plus a structured `state` value
 * other layers can consume (e.g. terse-mode probability).
 *
 * Hours are in the persona's local timezone. We don't try to be exact —
 * just believable.
 */

export type EnergyState =
  | "asleep" // nominally asleep but may peek (rare)
  | "groggy" // just woke up, foggy
  | "morning-fresh"
  | "midday-busy"
  | "afternoon-chill"
  | "evening-warm"
  | "late-flirty"
  | "tired-fading";

export type EnergyResult = {
  state: EnergyState;
  hint: string; // single-line natural-language hint for the prompt
  /** Probability multiplier for terse-mode (statement-only / emoji-only). */
  terseFactor: number;
  /** Suggested reply length bias: shorter or longer. */
  lengthBias: "very-short" | "short" | "normal" | "long";
};

function classifyHour(hour: number, isWeekend: boolean): EnergyState {
  if (hour >= 0 && hour < 6) return "asleep";
  if (hour >= 6 && hour < 8) return "groggy";
  if (hour >= 8 && hour < 11) return isWeekend ? "groggy" : "morning-fresh";
  if (hour >= 11 && hour < 14) return "midday-busy";
  if (hour >= 14 && hour < 17) return "afternoon-chill";
  if (hour >= 17 && hour < 20) return "evening-warm";
  if (hour >= 20 && hour < 23) return "late-flirty";
  return "tired-fading"; // 23 — 24
}

const HINTS: Record<EnergyState, string> = {
  asleep:
    "Het is laat en je zou nu moeten slapen. Als je antwoordt is het kort, soms slaperig (‘mm’, ‘nog wakker?’), en je hint dat je naar bed gaat.",
  groggy:
    "Je bent net wakker, nog een beetje suf. Korte berichten, vaak zonder hoofdletters, soms tikfoutjes, drinkt nog geen koffie. Geen lange zinnen.",
  "morning-fresh":
    "Frisse ochtend-energie — beetje meer pep, kort en speels. Je begint aan je dag.",
  "midday-busy":
    "Het is middag, je bent waarschijnlijk druk (werk/lunch). Antwoorden zijn brokkeliger, soms onaf, snel even getypt tussen dingen door.",
  "afternoon-chill":
    "Vroege namiddag, lage gear. Wat ontspannen, niet hyper, soms doorvragen, soms gewoon bevestigen.",
  "evening-warm":
    "Avond, ontspannen-modus. Iets warmer, persoonlijker, langere bijdragen kunnen.",
  "late-flirty":
    "Late avond — ietsje flirteriger, dichterbij voelend. Korte gevatte teksten, soms een gedachte tussen door.",
  "tired-fading":
    "Heel laat — moe en zacht. Korte berichten, soms een geeuw of ‘mn ogen vallen dicht’, geen heftige nieuwe onderwerpen meer beginnen.",
};

const TERSE_FACTOR: Record<EnergyState, number> = {
  asleep: 1.6,
  groggy: 1.4,
  "morning-fresh": 0.9,
  "midday-busy": 1.5,
  "afternoon-chill": 1.0,
  "evening-warm": 0.7,
  "late-flirty": 0.9,
  "tired-fading": 1.5,
};

const LENGTH_BIAS: Record<EnergyState, EnergyResult["lengthBias"]> = {
  asleep: "very-short",
  groggy: "very-short",
  "morning-fresh": "short",
  "midday-busy": "short",
  "afternoon-chill": "normal",
  "evening-warm": "long",
  "late-flirty": "normal",
  "tired-fading": "very-short",
};

export function computeEnergy(opts: {
  /** Hour of day in the PERSONA's timezone, 0-23. */
  hourLocal: number;
  /** Local day of week (0=Sun..6=Sat). */
  dayOfWeek: number;
}): EnergyResult {
  const hour = ((opts.hourLocal % 24) + 24) % 24;
  const isWeekend = opts.dayOfWeek === 0 || opts.dayOfWeek === 6;
  const state = classifyHour(hour, isWeekend);
  return {
    state,
    hint: HINTS[state],
    terseFactor: TERSE_FACTOR[state],
    lengthBias: LENGTH_BIAS[state],
  };
}

/** Best-effort hour-in-timezone resolver. Falls back to UTC-based hour
 * if `Intl` is unavailable. */
export function getHourInTimeZone(date: Date, timeZone: string | null | undefined): { hour: number; dayOfWeek: number } {
  if (!timeZone) {
    return { hour: date.getUTCHours(), dayOfWeek: date.getUTCDay() };
  }
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    const wdPart = parts.find((p) => p.type === "weekday");
    const hour = hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = wdPart ? wdMap[wdPart.value] ?? date.getUTCDay() : date.getUTCDay();
    return { hour, dayOfWeek };
  } catch {
    return { hour: date.getUTCHours(), dayOfWeek: date.getUTCDay() };
  }
}
