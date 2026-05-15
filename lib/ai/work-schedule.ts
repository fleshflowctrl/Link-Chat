/**
 * Per-persona-per-day work-schedule modelling.
 *
 * Without this, every persona is on her phone 24/7 between bedtime and
 * wake-up, which feels obviously synthetic when her bio says "I'm a
 * primary-school teacher". Real people are away from their phone during
 * work hours, replies cluster around breaks and after-hours, and a
 * conscientious texter often warns "ik moet zo aan het werk, spreek je
 * later".
 *
 * Architecture mirrors lib/ai/bedtime.ts:
 *   - classifyOccupation(text) maps Grok's free-form occupation string
 *     to a category enum via keyword match. Robust to variations
 *     ("juf", "leerkracht", "basisschooljuf" all → school_teacher).
 *   - Each category has a deterministic schedule (work days, work
 *     hours, breaks). For variability we hash on (personaId, ymd) so
 *     two teachers don't have identical pause minutes.
 *   - getWorkContext(now, …) returns the current phase + a Grok-
 *     friendly prompt-hint + scheduling timestamps the pacing module
 *     uses to clamp replies into break windows.
 *
 * Used by:
 *   - lib/ai/reply-pacing.ts — to decide work-mode vs awake-mode delivery.
 *     During "working" phase replies are scheduled for the next break
 *     or for end-of-shift; during "approaching_work" the pacing layer
 *     clamps the reply to land before her shift starts so a "ik moet zo
 *     werken" goodbye fits.
 *   - lib/ai/build-grok-system-prompt.ts — to inject occupation-aware
 *     hints (e.g. "you're a teacher, the bell goes in 10 minutes,
 *     warmly say you'll text after class").
 */

export type OccupationCategory =
  | "school_teacher"
  | "healthcare_dayshift"
  | "office_hours"
  | "retail_horeca"
  | "student"
  | "freelance_creative"
  | "fitness_active"
  | "flexible";

export type WorkPhase =
  | "off"
  | "approaching_work"
  | "working"
  | "break"
  | "lunch_break"
  | "ending_work";

export type WorkContext = {
  category: OccupationCategory;
  phase: WorkPhase;
  /** Localised wall-clock label for prompts ("vrijdag 13:42"). */
  localTimeLabel: string;
  /** Concrete instant when the current phase ends. Used by pacing
   * layer to clamp a reply so it lands within the right window. */
  phaseEndsAt: Date;
  /** Concrete instant of her next "freely available" moment — i.e.
   * end of shift on a workday, or "now" if she's off. Pacing schedules
   * delayed replies for this when she's working. */
  nextAvailableAt: Date;
  /** Free-form Dutch hint to inject into the Grok system prompt so her
   * next message naturally references her work context. Empty string
   * when phase === "off" so we don't nag the model unnecessarily. */
  promptHint: string;
};

/** ---------------------------- classification ----------------------- */

const KEYWORDS_BY_CATEGORY: Record<OccupationCategory, readonly string[]> = {
  school_teacher: [
    "juf",
    "meester",
    "leraar",
    "leerkracht",
    "leerkracht",
    "docent",
    "basisschool",
    "lesgeven",
    "pabo",
    "intern begeleider",
    "leerlingbegeleider",
    "schoolmentor",
    "vmbo",
    "havo",
    "vwo",
    "voortgezet onderwijs",
    "kinderopvang",
    "pedagogisch medewerker",
    "kinderdagverblijf",
    "kdv",
    "buitenschoolse opvang",
    "bso",
  ],
  healthcare_dayshift: [
    "verpleegkundige",
    "verzorgende",
    "fysiotherapeut",
    "tandartsassistent",
    "tandartsassistente",
    "huidtherapeut",
    "doktersassistent",
    "doktersassistente",
    "huisartsenpraktijk",
    "logopedist",
    "podotherapeut",
    "diëtist",
    "ergotherapeut",
    "apothekersassistent",
    "apothekersassistente",
    "wijkverpleegkundige",
    "kinderverpleegkundige",
    "vroedvrouw",
  ],
  office_hours: [
    "marketing",
    "recruiter",
    "hr",
    "human resources",
    "advocaat",
    "advocatenkantoor",
    "consultant",
    "accountant",
    "controller",
    "administratie",
    "klantenservice",
    "callcenter",
    "social media manager",
    "data-analist",
    "data analyst",
    "data analist",
    "developer",
    "softwareontwikkelaar",
    "software engineer",
    "designer",
    "ontwerper",
    "ux-designer",
    "uxdesigner",
    "grafisch ontwerper",
    "copywriter",
    "redacteur",
    "journalist",
    "uitgeverij",
    "fintech",
    "verzekeraar",
    "bank",
    "kantoor",
    "secretaresse",
    "office manager",
    "projectmanager",
    "junior",
    "stagiair",
    "stage",
  ],
  retail_horeca: [
    "barista",
    "serveerster",
    "serveer",
    "horeca",
    "kelner",
    "ober",
    "bistro",
    "restaurant",
    "cafe",
    "café",
    "winkelmedewerker",
    "verkoopadviseur",
    "kassa",
    "kassière",
    "kapper",
    "kapster",
    "kapsalon",
    "nail-tech",
    "nagelstyliste",
    "make-up artist",
    "visagist",
    "visagiste",
    "magazijn",
    "magazijnmedewerker",
    "kledingwinkel",
  ],
  student: [
    "studeer",
    "studeert",
    "studie",
    "student",
    "studente",
    "master",
    "bachelor",
    "hbo",
    "universiteit",
    "wo",
    "studentassistent",
    "schoolkrant",
    "tweedejaars",
    "derdejaars",
    "scriptie",
    "stagiair",
  ],
  freelance_creative: [
    "freelance",
    "zzp",
    "zelfstandig ondernemer",
    "fotograaf",
    "fotografe",
    "illustrator",
    "kunstenaar",
    "schilder",
    "schrijver",
    "blogger",
    "content creator",
    "contentcreator",
    "youtuber",
    "twitch",
    "podcaster",
  ],
  fitness_active: [
    "yoga-instructeur",
    "yogadocent",
    "yoga docent",
    "personal trainer",
    "pt ",
    "fitness instructeur",
    "fitnessinstructeur",
    "sportinstructeur",
    "pilates",
    "bootcamp",
    "spinning",
  ],
  flexible: [],
};

/** Map free-form occupation text to a category. Order matters: more
 * specific categories (school_teacher, healthcare) are checked before
 * generic ones (office_hours, freelance_creative) so "freelance
 * fotograaf" lands in freelance, not in office_hours. */
export function classifyOccupation(occupation: string | null | undefined): OccupationCategory {
  if (!occupation) return "flexible";
  const t = occupation.toLowerCase();
  // Specific first.
  const order: OccupationCategory[] = [
    "school_teacher",
    "healthcare_dayshift",
    "fitness_active",
    "freelance_creative",
    "student",
    "retail_horeca",
    "office_hours",
  ];
  for (const cat of order) {
    const keywords = KEYWORDS_BY_CATEGORY[cat];
    for (const kw of keywords) {
      if (t.includes(kw)) return cat;
    }
  }
  return "flexible";
}

/** ---------------------------- schedules ---------------------------- */

/** A single shift block. Times are decimal hours in tz wall clock.
 * Breaks are sub-windows inside the shift. */
type ShiftBlock = {
  startHour: number;
  endHour: number;
  /** Short break (5-15 min): she might glance at her phone, replies
   * are short. */
  shortBreaks?: Array<{ atHour: number; durationMin: number }>;
  /** Lunch break (~30 min): more relaxed, can chat normally. */
  lunchBreak?: { atHour: number; durationMin: number };
};

type Schedule = {
  /** Weekdays the persona works. 0=Sunday … 6=Saturday. */
  workDays: ReadonlyArray<number>;
  /** Shift blocks for a workday. Most categories have a single block.
   * fitness_active uses two (early morning + evening). */
  shifts: ReadonlyArray<ShiftBlock>;
  /** Minutes before shift-start when phase becomes "approaching_work". */
  approachWindowMin: number;
  /** Minutes before shift-end when phase becomes "ending_work". */
  endingWindowMin: number;
};

const SCHEDULE_BY_CATEGORY: Record<OccupationCategory, Schedule | null> = {
  school_teacher: {
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    shifts: [
      {
        startHour: 8.25, // 08:15 — bell goes 08:30 but she's in early
        endHour: 15.75,  // 15:45 — bell at 15:30 + admin
        shortBreaks: [
          { atHour: 10.25, durationMin: 15 }, // ochtendpauze
        ],
        lunchBreak: { atHour: 12.0, durationMin: 30 },
      },
    ],
    approachWindowMin: 30,
    endingWindowMin: 20,
  },
  healthcare_dayshift: {
    workDays: [1, 2, 3, 4, 5],
    shifts: [
      {
        startHour: 8.0,
        endHour: 16.5,
        shortBreaks: [{ atHour: 10.5, durationMin: 10 }],
        lunchBreak: { atHour: 12.5, durationMin: 30 },
      },
    ],
    approachWindowMin: 30,
    endingWindowMin: 20,
  },
  office_hours: {
    workDays: [1, 2, 3, 4, 5],
    shifts: [
      {
        startHour: 9.0,
        endHour: 17.5,
        shortBreaks: [
          { atHour: 11.0, durationMin: 10 },
          { atHour: 15.0, durationMin: 10 },
        ],
        lunchBreak: { atHour: 12.5, durationMin: 45 },
      },
    ],
    approachWindowMin: 25,
    endingWindowMin: 30,
  },
  retail_horeca: {
    // Variable shifts in real life; we model an evening-skewed default
    // (Mon-Sat, 11:00-19:00) which is the most common pattern for retail.
    // Horeca workers often work later but the pacing layer is forgiving
    // enough that a 19:00 cutoff still feels natural.
    workDays: [1, 2, 3, 4, 5, 6],
    shifts: [
      {
        startHour: 11.0,
        endHour: 19.0,
        shortBreaks: [{ atHour: 14.5, durationMin: 15 }],
        lunchBreak: { atHour: 13.5, durationMin: 30 },
      },
    ],
    approachWindowMin: 25,
    endingWindowMin: 25,
  },
  student: {
    // Students are NOT working when "in college" — but they have flexible
    // schedules. We model 10:00-15:00 as "in college" Mon-Thu, with
    // generous breaks since most students sneak phone time. Fri/weekend
    // they're free.
    workDays: [1, 2, 3, 4],
    shifts: [
      {
        startHour: 10.0,
        endHour: 15.0,
        shortBreaks: [
          { atHour: 11.0, durationMin: 15 },
          { atHour: 13.5, durationMin: 15 },
        ],
        lunchBreak: { atHour: 12.5, durationMin: 30 },
      },
    ],
    approachWindowMin: 20,
    endingWindowMin: 30,
  },
  freelance_creative: {
    // Freelancers work in deep-work blocks but at variable times. We
    // model a single ~3h "deep work" block in the afternoon (13:00-16:00)
    // Mon-Thu so she's mostly available but occasionally goes dark.
    workDays: [1, 2, 3, 4],
    shifts: [
      {
        startHour: 13.0,
        endHour: 16.0,
        shortBreaks: [{ atHour: 14.5, durationMin: 10 }],
      },
    ],
    approachWindowMin: 15,
    endingWindowMin: 15,
  },
  fitness_active: {
    // Fitness instructors typically have early-morning + evening blocks
    // teaching classes; midday they're often free. Two shift blocks.
    workDays: [1, 2, 3, 4, 5],
    shifts: [
      {
        startHour: 6.5,
        endHour: 9.5,
        shortBreaks: [{ atHour: 8.0, durationMin: 10 }],
      },
      {
        startHour: 17.5,
        endHour: 20.5,
        shortBreaks: [{ atHour: 19.0, durationMin: 10 }],
      },
    ],
    approachWindowMin: 20,
    endingWindowMin: 15,
  },
  flexible: null,
};

/** ---------------------------- helpers ------------------------------ */

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function ymdInTz(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function hourFloatInTz(d: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const text = fmt.format(d);
    const [h, m] = text.split(":").map((n) => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return d.getHours();
    return ((h % 24) + 24) % 24 + m / 60;
  } catch {
    return d.getHours();
  }
}

function weekdayInTz(d: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
    });
    const text = fmt.format(d).toLowerCase();
    if (text.startsWith("sun")) return 0;
    if (text.startsWith("mon")) return 1;
    if (text.startsWith("tue")) return 2;
    if (text.startsWith("wed")) return 3;
    if (text.startsWith("thu")) return 4;
    if (text.startsWith("fri")) return 5;
    if (text.startsWith("sat")) return 6;
    return d.getUTCDay();
  } catch {
    return d.getUTCDay();
  }
}

function dateAtLocalWallClock(
  ymd: string,
  hourFloat: number,
  timeZone: string,
): Date {
  const h = Math.floor(hourFloat);
  const minutes = Math.floor((hourFloat - h) * 60);
  const wall = `${ymd}T${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  let candidate = new Date(`${wall}Z`);
  for (let i = 0; i < 2; i++) {
    const projected = hourFloatInTz(candidate, timeZone);
    const desired = h + minutes / 60;
    const diffMin = Math.round((desired - projected) * 60);
    if (diffMin === 0) break;
    candidate = new Date(candidate.getTime() + diffMin * 60_000);
  }
  return candidate;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatDayLabel(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Per-persona-per-day jitter so two personas in the same category
 * don't have identical lunch-minute timing. ±10 minutes around any
 * scheduled hour. */
function jitterMinutes(personaId: string, ymd: string, slot: string): number {
  const h = fnv1a(`work|${personaId}|${ymd}|${slot}`);
  return ((h % 21) - 10) | 0; // -10 … +10 minutes
}

/** ---------------------------- public API --------------------------- */

export function getWorkContext(opts: {
  now: Date;
  timeZone: string;
  personaId: string;
  occupation: string | null | undefined;
}): WorkContext {
  const category = classifyOccupation(opts.occupation);
  const schedule = SCHEDULE_BY_CATEGORY[category];
  const localTimeLabel = formatDayLabel(opts.now, opts.timeZone);

  // Flexible / no schedule → always off, no prompt-hint.
  if (!schedule) {
    return {
      category,
      phase: "off",
      localTimeLabel,
      phaseEndsAt: opts.now,
      nextAvailableAt: opts.now,
      promptHint: "",
    };
  }

  const todayYmd = ymdInTz(opts.now, opts.timeZone);
  const dow = weekdayInTz(opts.now, opts.timeZone);
  const isWorkDay = schedule.workDays.includes(dow);
  const nowHour = hourFloatInTz(opts.now, opts.timeZone);

  // Resolve concrete shift-block instants for today (jittered per persona).
  const todaysShifts = schedule.shifts.map((shift, idx) => {
    const startJitter = jitterMinutes(opts.personaId, todayYmd, `s${idx}`) / 60;
    const start = shift.startHour + startJitter;
    const end = shift.endHour + startJitter; // shift the whole block together
    return {
      ...shift,
      startHour: start,
      endHour: end,
      startAt: dateAtLocalWallClock(todayYmd, start, opts.timeZone),
      endAt: dateAtLocalWallClock(todayYmd, end, opts.timeZone),
    };
  });

  // ----- Helper to assemble a result object with prompt-hint per phase ---
  const buildHint = (
    phase: WorkPhase,
    occupationLabel: string,
  ): string => {
    if (phase === "approaching_work") {
      return (
        `- Werk-context: je werkt als ${occupationLabel} en je shift begint zo. ` +
        `Schrijf vlak voor je begint een korte afsluiting (zoals "ik moet zo aan het werk, spreek je in de pauze" of "moet zo gaan, hoor je later"). ` +
        `Niet abrupt — gewoon zoals je dat tegen iemand zou zeggen. Geen specifieke pauzetijd verzinnen.`
      );
    }
    if (phase === "working") {
      return (
        `- Werk-context: je bent ${occupationLabel} en je werkt nu. ` +
        `Hou het kort, want je telefoon zou eigenlijk weg moeten zijn — een paar woorden tussen taken door, of "tussen werk door even" / "snel op de WC even". ` +
        `Geen lange verhalen tijdens werk.`
      );
    }
    if (phase === "break") {
      return (
        `- Werk-context: je bent ${occupationLabel} en hebt nu kort pauze. ` +
        `Reageer wel maar gehaast — pauze is kort, je weet dat je zo weer aan de slag moet. Geen lange verhalen.`
      );
    }
    if (phase === "lunch_break") {
      return (
        `- Werk-context: je bent ${occupationLabel} en hebt nu lunchpauze. ` +
        `Iets meer ruimte dan gewoonlijk in werktijd, maar nog steeds niet uitgebreid — je eet ook even.`
      );
    }
    if (phase === "ending_work") {
      return (
        `- Werk-context: je bent ${occupationLabel} en je shift loopt op zijn eind. ` +
        `Je kan al iets meer reageren maar bent nog ter plaatse; misschien noemen dat je zo klaar bent ("nog half uurtje, dan ben ik vrij").`
      );
    }
    return "";
  };

  // Lookup label for the prompt — we want a concrete noun, not the
  // abstract category.
  const occupationLabel = (opts.occupation ?? "").trim() || categoryFallbackLabel(category);

  // Default: not a workday → always off.
  if (!isWorkDay) {
    return {
      category,
      phase: "off",
      localTimeLabel,
      phaseEndsAt: opts.now,
      nextAvailableAt: opts.now,
      promptHint: "",
    };
  }

  // ----- Phase resolution: walk the shifts in order ----------------------
  // 1. approaching_work: within approachWindowMin of the next shift start
  //                      (and not yet inside a shift)
  // 2. working / break / lunch_break: inside a shift block
  // 3. ending_work: within endingWindowMin of shift-end, still inside
  // 4. off: between or after shifts
  for (const shift of todaysShifts) {
    if (opts.now < shift.startAt) {
      const minsUntil = (shift.startAt.getTime() - opts.now.getTime()) / 60_000;
      if (minsUntil <= schedule.approachWindowMin) {
        return {
          category,
          phase: "approaching_work",
          localTimeLabel,
          phaseEndsAt: shift.startAt,
          nextAvailableAt: shift.endAt,
          promptHint: buildHint("approaching_work", occupationLabel),
        };
      }
      // Not yet near this shift; she's in "off" until approach kicks in.
      return {
        category,
        phase: "off",
        localTimeLabel,
        phaseEndsAt: shift.startAt,
        nextAvailableAt: shift.startAt,
        promptHint: "",
      };
    }
    if (opts.now >= shift.startAt && opts.now < shift.endAt) {
      // Inside this shift. Ending window first.
      const minsUntilEnd = (shift.endAt.getTime() - opts.now.getTime()) / 60_000;
      if (minsUntilEnd <= schedule.endingWindowMin) {
        return {
          category,
          phase: "ending_work",
          localTimeLabel,
          phaseEndsAt: shift.endAt,
          nextAvailableAt: shift.endAt,
          promptHint: buildHint("ending_work", occupationLabel),
        };
      }
      // Lunch break?
      if (shift.lunchBreak) {
        const lunchJitter = jitterMinutes(opts.personaId, todayYmd, "lunch") / 60;
        const lunchStart = dateAtLocalWallClock(
          todayYmd,
          shift.lunchBreak.atHour + lunchJitter,
          opts.timeZone,
        );
        const lunchEnd = new Date(
          lunchStart.getTime() + shift.lunchBreak.durationMin * 60_000,
        );
        if (opts.now >= lunchStart && opts.now < lunchEnd) {
          return {
            category,
            phase: "lunch_break",
            localTimeLabel,
            phaseEndsAt: lunchEnd,
            nextAvailableAt: shift.endAt,
            promptHint: buildHint("lunch_break", occupationLabel),
          };
        }
      }
      // Short break?
      for (const br of shift.shortBreaks ?? []) {
        const brJitter = jitterMinutes(opts.personaId, todayYmd, `br${br.atHour}`) / 60;
        const brStart = dateAtLocalWallClock(
          todayYmd,
          br.atHour + brJitter,
          opts.timeZone,
        );
        const brEnd = new Date(brStart.getTime() + br.durationMin * 60_000);
        if (opts.now >= brStart && opts.now < brEnd) {
          return {
            category,
            phase: "break",
            localTimeLabel,
            phaseEndsAt: brEnd,
            nextAvailableAt: shift.endAt,
            promptHint: buildHint("break", occupationLabel),
          };
        }
      }
      // Otherwise actively working.
      // Find the next break (or end of shift) so the pacing layer can
      // schedule a delayed reply for that exact moment.
      const nextBreakAt = nextBreakInstant(
        opts.now,
        todayYmd,
        opts.timeZone,
        opts.personaId,
        shift,
      );
      return {
        category,
        phase: "working",
        localTimeLabel,
        phaseEndsAt: nextBreakAt ?? shift.endAt,
        nextAvailableAt: nextBreakAt ?? shift.endAt,
        promptHint: buildHint("working", occupationLabel),
      };
    }
  }

  // Past all shifts for today → off until tomorrow.
  return {
    category,
    phase: "off",
    localTimeLabel,
    phaseEndsAt: dateAtLocalWallClock(addDaysYmd(todayYmd, 1), 0, opts.timeZone),
    nextAvailableAt: opts.now,
    promptHint: "",
  };
}

function nextBreakInstant(
  now: Date,
  todayYmd: string,
  timeZone: string,
  personaId: string,
  shift: { lunchBreak?: { atHour: number; durationMin: number }; shortBreaks?: Array<{ atHour: number; durationMin: number }> },
): Date | null {
  const candidates: Date[] = [];
  if (shift.lunchBreak) {
    const j = jitterMinutes(personaId, todayYmd, "lunch") / 60;
    candidates.push(
      dateAtLocalWallClock(todayYmd, shift.lunchBreak.atHour + j, timeZone),
    );
  }
  for (const br of shift.shortBreaks ?? []) {
    const j = jitterMinutes(personaId, todayYmd, `br${br.atHour}`) / 60;
    candidates.push(dateAtLocalWallClock(todayYmd, br.atHour + j, timeZone));
  }
  const future = candidates
    .filter((d) => d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? null;
}

function categoryFallbackLabel(c: OccupationCategory): string {
  switch (c) {
    case "school_teacher":
      return "leerkracht";
    case "healthcare_dayshift":
      return "in de zorg";
    case "office_hours":
      return "op kantoor";
    case "retail_horeca":
      return "in de horeca/retail";
    case "student":
      return "student";
    case "freelance_creative":
      return "freelancer";
    case "fitness_active":
      return "fitness instructeur";
    default:
      return "aan het werk";
  }
}
