"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
} from "framer-motion";
import {
  Apple,
  ArrowRight,
  ChevronLeft,
  Lock,
} from "lucide-react";
import {
  FUNNEL_ATTRACTION_VIBES,
  FUNNEL_DEFAULT_AGE_RANGE,
  FUNNEL_LOOKING_FOR,
  FUNNEL_MAX_VIBE_PICKS,
  FUNNEL_MY_AGE_BUCKETS,
  FUNNEL_SESSION_KEY,
  FUNNEL_WOMEN_AGE_PRESETS,
  ONBOARDED_KEY,
  funnelLookingForLabel,
  type FunnelAgeRange,
  type FunnelBasics,
  type FunnelFirstContact,
  type FunnelLookingFor,
} from "@/data/funnel";
import { funnelSets, type FunnelWelcomeCard } from "@/data/funnelProfiles";
import { likesPreviewAvatarUrls, profiles as staticCatalogProfiles, type Profile } from "@/data/profiles";
import {
  pickFunnelMatchProfiles,
  sharedVibeEmojis,
  type FunnelMatchPick,
} from "@/lib/funnel-match-picks";
import { clearLegacyFunnelLocalStorage } from "@/lib/client-user-session";
import { trackFunnelStep } from "@/lib/analytics/visitor-id";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT } from "@/lib/app-variant";
import {
  FunnelConfigProvider,
  useFunnelConfig,
} from "@/components/funnel/funnel-config-context";
import {
  funnelChoiceRowClass,
  funnelEmojiTileClass,
  funnelLookingForRowClass,
  funnelOptionSubClass,
  funnelOptionSubClassSm,
  funnelOptionTitleClass,
  funnelStepSubtitleClass,
  funnelStepTitleClass,
} from "@/lib/funnel/tile-styles";
import { ensureGuestSession, isPermanentAuthUser } from "@/lib/auth/guest-session";
import { STARTING_USER_CREDITS } from "@/lib/credits/pricing";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { SITE_DISPLAY } from "@/lib/brand";

const STEP_TOTAL = 6;
const FUNNEL_PICKED_PEER_KEY = "whisper_funnel_picked_peer";
/** Min time on “searching for your type” screen so the animation reads. */
const FUNNEL_COMPLETE_MIN_MS = 2800;
const WELCOME_MIN_PROFILE_AGE = 40;
const WELCOME_ONLINE_COUNT_TARGET = 847;

type FunnelGender = "man" | "woman";
type FunnelSeekingGender = "men" | "women" | "both";

type FunnelPersist = {
  step: number;
  lookingFor: FunnelLookingFor | null;
  gender: FunnelGender | null;
  seekingGender: FunnelSeekingGender | null;
  ageRange: FunnelAgeRange;
  vibes: string[];
  basics: FunnelBasics;
  firstContact: FunnelFirstContact;
  firstMessage: string;
};

const FUNNEL_LOOKING_IDS = new Set(FUNNEL_LOOKING_FOR.map((o) => o.id));

function normalizeLookingFor(raw: unknown): FunnelLookingFor | null {
  if (raw === "not_sure") return "notsure";
  if (typeof raw !== "string") return null;
  return FUNNEL_LOOKING_IDS.has(raw as FunnelLookingFor)
    ? (raw as FunnelLookingFor)
    : null;
}

function migrateFunnelStep(raw: number): number {
  if (raw <= 6) return raw;
  return STEP_TOTAL;
}

function normalizeVibes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !v.trim()) continue;
    if (out.includes(v)) continue;
    out.push(v);
    if (out.length >= FUNNEL_MAX_VIBE_PICKS) break;
  }
  return out;
}

function normalizeAgeRange(
  p: Partial<FunnelPersist> & { ageMin?: number; ageMax?: number },
): FunnelAgeRange {
  if (p.ageRange && typeof p.ageRange === "object") {
    const ar = p.ageRange as Partial<FunnelAgeRange>;
    return {
      min:
        typeof ar.min === "number"
          ? Math.min(80, Math.max(18, Math.round(ar.min)))
          : FUNNEL_DEFAULT_AGE_RANGE.min,
      max:
        typeof ar.max === "number"
          ? Math.min(80, Math.max(18, Math.round(ar.max)))
          : FUNNEL_DEFAULT_AGE_RANGE.max,
      anyAge: Boolean(ar.anyAge),
    };
  }
  const min =
    typeof p.ageMin === "number"
      ? Math.min(80, Math.max(18, Math.round(p.ageMin)))
      : FUNNEL_DEFAULT_AGE_RANGE.min;
  const max =
    typeof p.ageMax === "number"
      ? Math.min(80, Math.max(18, Math.round(p.ageMax)))
      : FUNNEL_DEFAULT_AGE_RANGE.max;
  return {
    min: Math.min(min, max - 2),
    max: Math.max(max, min + 2),
    anyAge: false,
  };
}

const DEFAULT_BASICS: FunnelBasics = {
  name: "",
  age: null,
  location: "Amsterdam",
  photo: null,
};

function normalizeBasics(
  p: Partial<FunnelPersist> & {
    name?: string;
    age?: string | number;
    location?: string;
  },
): FunnelBasics {
  if (p.basics && typeof p.basics === "object") {
    const b = p.basics as Record<string, unknown>;
    let age: number | null = null;
    const rawAge = b.age;
    if (typeof rawAge === "number" && Number.isFinite(rawAge)) {
      age = Math.round(rawAge);
    } else if (typeof rawAge === "string" && rawAge.trim()) {
      const n = parseInt(rawAge, 10);
      age = Number.isFinite(n) ? n : null;
    }
    return {
      name: typeof b.name === "string" ? b.name : DEFAULT_BASICS.name,
      age,
      location:
        typeof b.location === "string" && b.location.trim()
          ? b.location
          : DEFAULT_BASICS.location,
      photo: typeof b.photo === "string" && b.photo.length > 0 ? b.photo : null,
    };
  }
  const ageStr =
    typeof p.age === "number" && Number.isFinite(p.age)
      ? String(Math.round(p.age))
      : typeof p.age === "string"
        ? p.age
        : "";
  const parsed = parseInt(ageStr, 10);
  return {
    name: typeof p.name === "string" ? p.name : DEFAULT_BASICS.name,
    age: Number.isFinite(parsed) ? parsed : null,
    location:
      typeof p.location === "string" && p.location.trim()
        ? p.location
        : DEFAULT_BASICS.location,
    photo: null,
  };
}

function firstWordName(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? "";
}

function normalizeFirstContact(
  p: Partial<FunnelPersist> & { pickedMatchId?: string | null },
): FunnelFirstContact {
  if (p.firstContact && typeof p.firstContact === "object") {
    const fc = p.firstContact as Record<string, unknown>;
    const id = fc.profileId;
    return {
      profileId: typeof id === "string" && id.length > 0 ? id : null,
    };
  }
  if (typeof p.pickedMatchId === "string" && p.pickedMatchId.length > 0) {
    return { profileId: p.pickedMatchId };
  }
  return { profileId: null };
}

const defaultPersist = (): FunnelPersist => ({
  step: 1,
  lookingFor: null,
  gender: "man",
  seekingGender: "women",
  ageRange: { ...FUNNEL_DEFAULT_AGE_RANGE },
  vibes: [],
  basics: { ...DEFAULT_BASICS },
  firstContact: { profileId: null },
  firstMessage: "",
});

function normalizeGender(raw: unknown): FunnelGender | null {
  if (raw === "man" || raw === "woman") return raw;
  return null;
}

function normalizeSeekingGender(raw: unknown): FunnelSeekingGender | null {
  if (raw === "men" || raw === "women" || raw === "both") return raw;
  return null;
}

function loadSession(): FunnelPersist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FUNNEL_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<FunnelPersist> & {
      lookingForId?: string;
    };
    const lf =
      normalizeLookingFor(p.lookingFor) ??
      normalizeLookingFor(p.lookingForId);
    const ageRange = normalizeAgeRange(p);
    const basics = normalizeBasics(p);
    const firstContact = normalizeFirstContact(
      p as Partial<FunnelPersist> & { pickedMatchId?: string | null },
    );
    const rawStep = Math.max(1, Number(p.step) || 1);
    const step = migrateFunnelStep(rawStep);

    return {
      ...defaultPersist(),
      ...p,
      lookingFor: lf,
      gender: normalizeGender(p.gender) ?? "man",
      seekingGender: normalizeSeekingGender(p.seekingGender) ?? "women",
      ageRange,
      vibes: normalizeVibes(p.vibes),
      basics,
      firstContact,
      step: Math.min(STEP_TOTAL, Math.max(1, step)),
    };
  } catch {
    return null;
  }
}

function saveSession(p: FunnelPersist) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(p));
}

function OnboardingFunnelFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F3EE] text-sm font-medium text-gray-500">
      Laden…
    </div>
  );
}

export function OnboardingFunnel({
  initialCatalog,
  variant = DEFAULT_APP_VARIANT,
}: {
  initialCatalog?: Profile[];
  variant?: AppVariant;
}) {
  return (
    <FunnelConfigProvider variant={variant}>
      <Suspense fallback={<OnboardingFunnelFallback />}>
        <OnboardingFunnelInner initialCatalog={initialCatalog} />
      </Suspense>
    </FunnelConfigProvider>
  );
}

function OnboardingFunnelInner({
  initialCatalog,
}: {
  initialCatalog?: Profile[];
}) {
  const cfg = useFunnelConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const testFunnel = searchParams.get("testFunnel") === "1";
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [navDir, setNavDir] = useState(1);
  const persistRef = useRef<FunnelPersist>(defaultPersist());
  const step2Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lookingFor, setLookingFor] = useState<FunnelLookingFor | null>(null);
  const [gender, setGender] = useState<FunnelGender | null>(null);
  const [seekingGender, setSeekingGender] = useState<FunnelSeekingGender | null>(null);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState<FunnelAgeRange>(() => ({
    ...FUNNEL_DEFAULT_AGE_RANGE,
  }));
  const [basics, setBasics] = useState<FunnelBasics>(() => ({ ...DEFAULT_BASICS }));
  const [firstContact, setFirstContact] = useState<FunnelFirstContact>({
    profileId: null,
  });
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const matchAgeMin = ageRange.anyAge ? 40 : ageRange.min;
  const matchAgeMax = ageRange.anyAge ? 70 : ageRange.max;

  const funnelCatalog = useMemo(
    () =>
      initialCatalog && initialCatalog.length > 0 ? initialCatalog : staticCatalogProfiles,
    [initialCatalog],
  );

  const matches = useMemo(
    () =>
      pickFunnelMatchProfiles(
        funnelCatalog,
        selectedVibes,
        lookingFor,
        matchAgeMin,
        matchAgeMax,
      ),
    [funnelCatalog, selectedVibes, lookingFor, matchAgeMin, matchAgeMax],
  );

  const pickedMatch = useMemo(
    () => matches.find((m) => m.id === firstContact.profileId) ?? null,
    [matches, firstContact.profileId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    void (async () => {
      if (testFunnel) {
        try {
          localStorage.removeItem(ONBOARDED_KEY);
          sessionStorage.removeItem(FUNNEL_SESSION_KEY);
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setStep(1);
          setHydrated(true);
        }
        return;
      }

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (cancelled) return;
          if (isPermanentAuthUser(user)) {
            router.replace(cfg.discoverPath);
            return;
          }
        } catch {
          /* continue to funnel */
        }
      }

      if (localStorage.getItem(ONBOARDED_KEY) === "true") {
        router.replace(cfg.discoverPath);
        return;
      }

      const saved = loadSession();
      if (saved) {
        persistRef.current = saved;
        setStep(saved.step);
        setLookingFor(saved.lookingFor);
        setGender(saved.gender);
        setSeekingGender(saved.seekingGender);
        setAgeRange(saved.ageRange);
        setSelectedVibes(saved.vibes);
        setBasics(saved.basics);
        setFirstContact(saved.firstContact);
      }
      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, cfg.discoverPath, testFunnel]);

  const persistNow = useCallback(() => {
    const p: FunnelPersist = {
      step,
      lookingFor,
      gender: gender ?? "man",
      seekingGender: seekingGender ?? "women",
      ageRange,
      vibes: selectedVibes,
      basics,
      firstContact,
      firstMessage: "",
    };
    persistRef.current = p;
    saveSession(p);
  }, [
    step,
    lookingFor,
    gender,
    seekingGender,
    ageRange,
    selectedVibes,
    basics,
    firstContact,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    persistNow();
  }, [hydrated, persistNow]);

  // Server-side funnel-step tracking. The upsert is keyed on
  // (visitor_id, step) so repeated effects (HMR, double mount, back/next)
  // are idempotent — totals stay accurate.
  useEffect(() => {
    if (!hydrated) return;
    void trackFunnelStep(step, cfg.variant);
  }, [hydrated, step, cfg.variant]);

  const goNext = useCallback(() => {
    setNavDir(1);
    setStep((s) => Math.min(STEP_TOTAL, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setNavDir(-1);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const progress = (step / STEP_TOTAL) * 100;

  const persistFunnelDemographics = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await ensureGuestSession();
    const res = await fetch("/api/me/funnel-bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        lookingFor,
        gender: "man",
        seekingGender: "women",
        ageRange,
        startingCredits: STARTING_USER_CREDITS,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Opslaan mislukt (${res.status})`);
    }
  }, [ageRange, lookingFor]);

  const [completingFunnel, setCompletingFunnel] = useState(false);

  const finishFunnelWithPick = useCallback(async () => {
    const pid = firstContact.profileId;
    if (!pid || !pickedMatch) return;

    setFunnelError(null);
    setCompletingFunnel(true);
    const startedAt = Date.now();
    try {
      await persistFunnelDemographics();
      const waitMs = Math.max(0, FUNNEL_COMPLETE_MIN_MS - (Date.now() - startedAt));
      if (waitMs > 0) {
        await new Promise((r) => window.setTimeout(r, waitMs));
      }
      sessionStorage.setItem(FUNNEL_PICKED_PEER_KEY, pid);
      sessionStorage.removeItem(FUNNEL_SESSION_KEY);
      clearLegacyFunnelLocalStorage();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONBOARDED_KEY, "true");
      }
      sessionStorage.setItem(
        "whisper_discover_toast",
        `${pickedMatch.name} is jouw type — ontdek meer op ${SITE_DISPLAY} ✨`,
      );
      router.push(cfg.discoverPath);
    } catch (e) {
      setFunnelError(
        e instanceof Error ? e.message : "Kon niet doorgaan — probeer opnieuw",
      );
      setCompletingFunnel(false);
    }
  }, [
    cfg.discoverPath,
    firstContact.profileId,
    persistFunnelDemographics,
    pickedMatch,
    router,
  ]);

  const slideVariants = {
    initial: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 28 : -28, opacity: 0 }),
  };

  const accentStyle = {
    "--funnel-accent": cfg.accent,
    "--funnel-accent-soft": cfg.accentSoft,
  } as CSSProperties;

  if (!hydrated) {
    return (
      <div
        className={`fixed inset-0 z-10 flex items-center justify-center overflow-hidden overscroll-none touch-manipulation ${cfg.cardBg}`}
        style={accentStyle}
      >
        <span className="text-sm text-gray-500">Laden…</span>
      </div>
    );
  }

  if (completingFunnel && pickedMatch) {
    return (
      <div className={`fixed inset-0 z-10 ${cfg.outerBg}`} style={accentStyle}>
        <FunnelFindingTypeScreen
          peer={pickedMatch}
          cardBg={cfg.cardBg}
          variant={cfg.variant}
        />
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-10 flex justify-center overflow-hidden overscroll-none touch-manipulation ${cfg.outerBg}`}
      style={accentStyle}
    >
      <div
        className={`relative flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden overscroll-none touch-manipulation ${cfg.cardBg} shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(60,40,20,0.12)]`}
      >
        {step > 1 && (
          <header
            className={`z-20 flex shrink-0 items-center gap-3 border-b px-4 py-2.5 pt-[max(6px,env(safe-area-inset-top))] backdrop-blur-sm ${cfg.headerBg}`}
          >
            <div className="flex w-8 shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={goBack}
                className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 transition active:scale-95 ${
                  cfg.variant === "v2"
                    ? "bg-[#353536] text-ink ring-white/10"
                    : "bg-white text-gray-700 ring-black/[0.06]"
                }`}
                aria-label="Terug"
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className={`h-1.5 overflow-hidden rounded-full ${
                cfg.variant === "v2" ? "bg-white/10" : "bg-gray-200"
              }`}>
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)]"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "tween", duration: 0.25 }}
                />
              </div>
            </div>
            <div className={`w-9 shrink-0 text-right text-[10px] font-medium ${
              cfg.variant === "v2" ? "text-inkMuted" : "text-gray-500"
            }`}>
              {step} / {STEP_TOTAL}
            </div>
          </header>
        )}

        {funnelError ? (
          <p className="shrink-0 px-4 py-2 text-center text-[12px] font-medium text-red-600">
            {funnelError}
          </p>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={navDir} mode="wait">
            <motion.div
              key={step}
              custom={navDir}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0 flex min-h-0 flex-col overflow-hidden overscroll-none"
            >
              {step === 1 && (
                <StepWelcome onStart={goNext} catalog={funnelCatalog} />
              )}
              {step === 2 && (
                <StepLookingFor
                  selected={lookingFor}
                  onSelect={(id) => {
                    setLookingFor(id);
                    if (step2Timer.current) clearTimeout(step2Timer.current);
                    step2Timer.current = setTimeout(() => goNext(), 300);
                  }}
                />
              )}
              {step === 3 && (
                <StepMyAge
                  selectedAge={basics.age}
                  onSelect={(age) => {
                    setBasics((b) => ({ ...b, age }));
                    setTimeout(() => goNext(), 300);
                  }}
                />
              )}
              {step === 4 && (
                <StepWomenAge
                  ageRange={ageRange}
                  onChange={setAgeRange}
                  onContinue={goNext}
                />
              )}
              {step === 5 && (
                <StepVibes
                  selected={selectedVibes}
                  onChange={setSelectedVibes}
                  onContinue={goNext}
                />
              )}
              {step === 6 && (
                <StepPickMatch
                  matches={matches}
                  lookingFor={lookingFor}
                  userVibes={selectedVibes}
                  selectedId={firstContact.profileId}
                  onSelect={(id) => setFirstContact({ profileId: id })}
                  onFinish={() => void finishFunnelWithPick()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const WELCOME_CARD_SLOTS = [
  {
    top: "top-[4%]",
    left: "left-[12%]",
    width: 108,
    rotate: -6,
  },
  {
    top: "top-[8%]",
    right: "right-[12%]",
    width: 116,
    rotate: 5,
  },
  {
    top: "top-[44%]",
    left: "left-[14%]",
    width: 96,
    rotate: -3,
  },
  {
    top: "top-[48%]",
    right: "right-[14%]",
    width: 104,
    rotate: 4,
  },
] as const;

/** Per-slot status pattern: cycles online/new/null/online so every
 * generated set has a couple of "NEW" badges and a couple of green
 * online dots regardless of what the real persona rows are tagged
 * with. Matches the visual rhythm of the hardcoded fallback sets. */
const WELCOME_STATUS_PATTERN: ReadonlyArray<FunnelWelcomeCard["status"]> = [
  "online",
  "new",
  "new",
  "online",
];

/** Map a real catalog Profile to the FunnelWelcomeCard shape.
 * First-name-only keeps the layout compact, city replaces the old
 * "5 km" distance label so the funnel reads like a real feed, and
 * status is assigned from the slot pattern (a real persona row's
 * status.variant is almost always 'active', which would otherwise
 * never produce a NEW badge). */
function catalogProfileToWelcomeCard(
  profile: Profile,
  slotIndex: number,
): FunnelWelcomeCard {
  const firstName = profile.name.split(/\s+/)[0] ?? profile.name;
  const city =
    typeof profile.city === "string" && profile.city.trim().length > 0
      ? profile.city.trim()
      : null;
  return {
    id: profile.id,
    name: firstName,
    age: profile.age,
    photo: profile.photo,
    city,
    status: WELCOME_STATUS_PATTERN[slotIndex % WELCOME_STATUS_PATTERN.length] ?? null,
  };
}

/** Build N sets of {WELCOME_CARD_SLOTS.length} cards from the live
 * catalog. Shuffled once per mount so different visitors see different
 * welcome reels. Falls back to the static `funnelSets` (hardcoded
 * Unsplash) when the catalog is empty (fresh DB / Supabase unreachable),
 * so the funnel always has something to animate. */
function buildWelcomeSetsFromCatalog(
  catalog: Profile[],
  perSet = WELCOME_CARD_SLOTS.length,
  setCount = 3,
): FunnelWelcomeCard[][] {
  if (!catalog || catalog.length < perSet) return funnelSets;

  const mature = catalog.filter((p) => p.age >= WELCOME_MIN_PROFILE_AGE);
  const pool = mature.length >= perSet ? mature : catalog;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const sets: FunnelWelcomeCard[][] = [];
  for (let s = 0; s < setCount; s++) {
    const slice = shuffled.slice(s * perSet, s * perSet + perSet);
    if (slice.length < perSet) break;
    sets.push(slice.map((p, i) => catalogProfileToWelcomeCard(p, i)));
  }
  return sets.length > 0 ? sets : funnelSets;
}

const WELCOME_COPY = {
  v1: {
    headline: ["Ontmoet vrouwen die", "weten wat ze willen."],
    subMuted: "Voor mannen 50+. ",
    subAccent: "Discreet · op jouw tempo.",
    socialLabel: "mannen 50+ actief vandaag",
  },
  v2: {
    headline: ["Meer tijd.", "Discreet flirten."],
    subMuted: "Voor mannen 50+. ",
    subAccent: "Geen haast · wel spanning.",
    socialLabel: "mannen 50+ actief vandaag",
  },
} as const;

function StepWelcome({
  onStart,
  catalog,
}: {
  onStart: () => void;
  catalog: Profile[];
}) {
  const cfg = useFunnelConfig();
  const isV2 = cfg.variant === "v2";
  const copy = WELCOME_COPY[cfg.variant];
  const countMv = useMotionValue(0);
  const [countLabel, setCountLabel] = useState("0");
  const [setIndex, setSetIndex] = useState(0);
  const lastInteractRef = useRef(0);

  // Built once per mount — Math.random in there means a fresh
  // shuffle per visit, but stable across re-renders within a session.
  const welcomeSets = useMemo(
    () => buildWelcomeSetsFromCatalog(catalog),
    [catalog],
  );

  const touchCards = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);

  useEffect(() => {
    const unsub = countMv.on("change", (v) => {
      setCountLabel(Math.round(v).toLocaleString());
    });
    const ctrl = animate(countMv, WELCOME_ONLINE_COUNT_TARGET, {
      duration: 1.2,
      ease: "easeOut",
    });
    return () => {
      unsub();
      ctrl.stop();
    };
  }, [countMv]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastInteractRef.current < 1500) return;
      setSetIndex((i) => (i + 1) % welcomeSets.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [welcomeSets.length]);

  const activeSet = welcomeSets[setIndex] ?? welcomeSets[0];

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-canvas font-sans">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[var(--funnel-accent-soft)]/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-pink-300/40 blur-3xl"
        aria-hidden
      />

      <div className="pointer-events-none z-40 flex shrink-0 items-center gap-3 px-5 pt-[max(8px,env(safe-area-inset-top))] pb-1">
        <div className="min-w-0 flex-1">
          <div
            className={`h-1.5 overflow-hidden rounded-full ${
              isV2 ? "bg-white/10" : "bg-gray-200"
            }`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)]"
              style={{ width: `${(1 / STEP_TOTAL) * 100}%` }}
              aria-hidden
            />
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-medium ${
            isV2 ? "text-inkMuted" : "text-gray-500"
          }`}
        >
          1 / {STEP_TOTAL}
        </span>
      </div>

      <div
        className="relative z-10 h-full min-h-0 w-full flex-1 touch-manipulation"
        onPointerDownCapture={touchCards}
      >
        {WELCOME_CARD_SLOTS.map((slot, slotIndex) => {
          const profile = activeSet[slotIndex];
          if (!profile) return null;
          const pos = [slot.top, "left" in slot ? slot.left : "", "right" in slot ? slot.right : ""]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={slotIndex}
              className={`absolute ${pos}`}
              style={{ width: slot.width }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 8 }}
                  transition={{
                    duration: 0.8,
                    ease: "easeInOut",
                    delay: slotIndex * 0.05,
                  }}
                  className="origin-center"
                >
                  <motion.div
                    animate={{
                      y: [0, -6, 0],
                      rotate: [slot.rotate, slot.rotate + 2, slot.rotate],
                    }}
                    transition={{
                      duration: 4 + slotIndex,
                      repeat: Infinity,
                      repeatType: "mirror",
                      ease: "easeInOut",
                    }}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-xl">
                      <Image
                        src={profile.photo}
                        alt=""
                        fill
                        className="object-cover"
                        sizes={`${slot.width}px`}
                        priority={setIndex === 0 && slotIndex < 2}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                      {profile.status === "online" && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 pl-2 pr-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
                          Nu online
                        </span>
                      )}
                      {profile.status === "new" && (
                        <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                          Nieuw
                        </span>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 pt-7">
                        <p className="text-left text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                          {profile.name}, {profile.age}
                        </p>
                        {profile.city ? (
                          <p className="mt-0.5 truncate text-left text-[10px] font-medium text-white/85">
                            {profile.city}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-auto z-20 shrink-0 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[clamp(0.75rem,2.5vmin,1.25rem)]">
        <h1 className="font-display text-[clamp(2.25rem,9vmin,3rem)] font-semibold leading-none tracking-tight text-ink">
          {SITE_DISPLAY}
        </h1>

        <h2
          className={`mt-2 max-w-[20ch] text-balance text-[clamp(1.35rem,5.2vmin,1.875rem)] font-extrabold leading-tight tracking-tight ${
            isV2 ? "text-ink" : "text-gray-900"
          }`}
        >
          <span className="block">{copy.headline[0]}</span>
          <span className="block">{copy.headline[1]}</span>
        </h2>

        <p className="mt-2 text-[clamp(12px,3.2vmin,14px)] leading-snug">
          <span className={isV2 ? "text-inkMuted" : "text-gray-600"}>
            {copy.subMuted}
          </span>
          <span className="font-bold text-[var(--funnel-accent)]">
            {copy.subAccent}
          </span>
        </p>

        <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 max-w-[70%] items-center gap-1.5">
            <div className="flex shrink-0 -space-x-1.5 pl-0.5">
              {likesPreviewAvatarUrls.map((url, i) => (
                <span
                  key={url}
                  className={`relative h-6 w-6 overflow-hidden rounded-full ring-2 ${
                    isV2 ? "ring-[#252526]" : "ring-[#F5F3EE]"
                  }`}
                  style={{ zIndex: 3 - i }}
                >
                  <Image
                    src={url}
                    alt=""
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
            <p
              className={`min-w-0 text-[11px] leading-snug ${
                isV2 ? "text-inkMuted" : "text-gray-700"
              }`}
            >
              <span
                className={`font-bold tabular-nums ${
                  isV2 ? "text-ink" : "text-gray-900"
                }`}
              >
                {countLabel}
              </span>{" "}
              {copy.socialLabel}
            </p>
          </div>
          <div
            className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 shadow-sm ring-1 ${
              isV2
                ? "bg-[#353536]/90 ring-white/10"
                : "bg-white/90 ring-black/[0.06]"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-semibold text-green-600">Live</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-3 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-95"
        >
          Aan de slag →
        </button>

        <p
          className={`mt-1.5 text-center text-[11px] ${
            isV2 ? "text-inkMuted" : "text-gray-500"
          }`}
        >
          <Link
            href={cfg.loginPath}
            className="font-bold text-[var(--funnel-accent)] underline-offset-2 hover:underline"
          >
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}

function StepLookingFor({
  selected,
  onSelect,
}: {
  selected: FunnelLookingFor | null;
  onSelect: (id: FunnelLookingFor) => void;
}) {
  const { variant } = useFunnelConfig();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Wat zoek je</span>
          <span className="block">op dit moment?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          Eerlijk antwoord = betere matches. Niemand ziet dit op je profiel.
        </p>
      </div>

      <ul className="mt-4 flex flex-col justify-start gap-3">
        {FUNNEL_LOOKING_FOR.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id} className="min-h-0 shrink">
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={funnelLookingForRowClass(
                  variant,
                  isSel,
                  opt.cardBg,
                  opt.cardBorder,
                )}
              >
                <span
                  className={funnelEmojiTileClass(variant, opt.tileBg)}
                  aria-hidden
                >
                  {opt.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={funnelOptionTitleClass(variant, "md")}>
                    {opt.label}
                  </span>
                  <span className={funnelOptionSubClass(variant)}>
                    {opt.description}
                  </span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <AnimatePresence mode="wait">
                    {isSel && (
                      <motion.span
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--funnel-accent)] text-[11px] font-bold text-white"
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function funnelPrimaryButtonClass(enabled: boolean): string {
  return `flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
    enabled
      ? "bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white shadow-lg"
      : "cursor-not-allowed bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white opacity-50 shadow-none"
  }`;
}

function StepMyAge({
  selectedAge,
  onSelect,
}: {
  selectedAge: number | null;
  onSelect: (age: number) => void;
}) {
  const { variant } = useFunnelConfig();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Hoe oud</span>
          <span className="block">ben je?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          Zo tonen we je vrouwen die bij jouw leeftijd passen.
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {FUNNEL_MY_AGE_BUCKETS.map((bucket) => {
          const isSel = selectedAge === bucket.age;
          return (
            <li key={bucket.id}>
              <button
                type="button"
                onClick={() => onSelect(bucket.age)}
                className={funnelChoiceRowClass(variant, isSel, "bg-blue-50")}
              >
                <span className="min-w-0 flex-1 text-center">
                  <span className={funnelOptionTitleClass(variant)}>{bucket.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepWomenAge({
  ageRange,
  onChange,
  onContinue,
}: {
  ageRange: FunnelAgeRange;
  onChange: (r: FunnelAgeRange) => void;
  onContinue: () => void;
}) {
  const { variant } = useFunnelConfig();
  const canContinue =
    ageRange.anyAge ||
    (ageRange.min >= 18 && ageRange.max >= ageRange.min);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Welke vrouwen</span>
          <span className="block">wil je zien?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          De meeste mannen hier kiezen 45–60.
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {FUNNEL_WOMEN_AGE_PRESETS.map((preset) => {
          const isSel =
            !ageRange.anyAge &&
            ageRange.min === preset.min &&
            ageRange.max === preset.max;
          return (
            <li key={preset.label}>
              <button
                type="button"
                onClick={() =>
                  onChange({ min: preset.min, max: preset.max, anyAge: false })
                }
                className={funnelChoiceRowClass(variant, isSel, "bg-pink-50")}
              >
                <span className="min-w-0 flex-1">
                  <span className={funnelOptionTitleClass(variant)}>
                    {preset.label} jaar
                  </span>
                  <span className={funnelOptionSubClassSm(variant)}>
                    Volwassen en zelfverzekerd
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() =>
              onChange({ min: 40, max: 65, anyAge: true })
            }
            className={funnelChoiceRowClass(variant, ageRange.anyAge, "bg-purple-50")}
          >
            <span className="min-w-0 flex-1">
              <span className={funnelOptionTitleClass(variant)}>
                Leeftijd maakt niet uit
              </span>
              <span className={funnelOptionSubClassSm(variant)}>
                Je ziet een brede mix
              </span>
            </span>
          </button>
        </li>
      </ul>

      <div className="mt-auto shrink-0 pt-4">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className={funnelPrimaryButtonClass(canContinue)}
        >
          Doorgaan →
        </button>
      </div>
    </div>
  );
}

function StepVibes({
  selected,
  onChange,
  onContinue,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const { variant } = useFunnelConfig();
  const canContinue = selected.length >= 1;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
      return;
    }
    if (selected.length >= FUNNEL_MAX_VIBE_PICKS) return;
    onChange([...selected, id]);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Wat trekt</span>
          <span className="block">je aan?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          Kies max. {FUNNEL_MAX_VIBE_PICKS} — wij zoeken vrouwen die daarbij passen.
        </p>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 content-start gap-2.5 overflow-y-auto overscroll-y-contain">
        {FUNNEL_ATTRACTION_VIBES.map((v) => {
          const isSel = selected.includes(v.id);
          const disabled =
            !isSel && selected.length >= FUNNEL_MAX_VIBE_PICKS;
          return (
            <button
              key={v.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(v.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition active:scale-[0.98] ${
                variant === "v2"
                  ? isSel
                    ? "bg-[#353536] ring-2 ring-[var(--funnel-accent)]"
                    : "border border-white/10 bg-[#2A2A2B] disabled:opacity-40"
                  : isSel
                    ? `${v.selectedBg} ring-2 ${v.selectedRing}`
                    : "border border-gray-200 bg-white disabled:opacity-40"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {v.emoji}
              </span>
              <span className={funnelOptionTitleClass(variant, "md")}>
                {v.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 pt-3">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className={funnelPrimaryButtonClass(canContinue)}
        >
          Doorgaan →
        </button>
      </div>
    </div>
  );
}

function StepBasics({
  basics,
  setBasics,
  onContinue,
}: {
  basics: FunnelBasics;
  setBasics: Dispatch<SetStateAction<FunnelBasics>>;
  onContinue: () => void;
}) {
  const nameOk = (firstWordName(basics.name) || basics.name.trim()).length > 0;
  const ageOk =
    basics.age !== null && Number.isFinite(basics.age) && basics.age >= 18;
  const ok = nameOk && ageOk;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="shrink-0 px-5 pt-1">
        <h2 className="text-balance text-[clamp(1.5rem,5.5vmin,1.875rem)] font-extrabold leading-tight text-gray-900">
          <span className="block">Vertel iets</span>
          <span className="block">over jezelf</span>
        </h2>
        <p className="mt-1 text-[clamp(12px,3.2vmin,14px)] text-gray-600">
          Nog een paar snelle vragen.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-y-[clamp(0.5rem,2vmin,1.25rem)] overflow-hidden px-5 py-1">
        <div className="min-h-0 w-full space-y-[clamp(0.75rem,2.5vmin,1.25rem)] text-[clamp(15px,3.8vmin,18px)] leading-relaxed text-gray-900">
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>Ik ben</span>
            <input
              autoFocus
              autoComplete="given-name"
              value={basics.name}
              onChange={(e) =>
                setBasics((b) => ({ ...b, name: e.target.value }))
              }
              onBlur={() =>
                setBasics((b) => ({ ...b, name: firstWordName(b.name) }))
              }
              placeholder="Lisa"
              className="inline-block w-[min(140px,42vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[var(--funnel-accent)] focus:ring-2 focus:ring-[var(--funnel-accent)]/30 sm:px-3 sm:py-1.5"
            />
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>en ik ben</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={18}
              max={99}
              value={basics.age === null ? "" : String(basics.age)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setBasics((b) => ({ ...b, age: null }));
                  return;
                }
                const n = parseInt(raw, 10);
                setBasics((b) => ({
                  ...b,
                  age: Number.isFinite(n) ? n : null,
                }));
              }}
              placeholder="28"
              className="inline-block w-[min(80px,22vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-center text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[var(--funnel-accent)] focus:ring-2 focus:ring-[var(--funnel-accent)]/30 sm:px-3 sm:py-1.5"
            />
            <span>jaar.</span>
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>Ik woon in</span>
            <input
              autoComplete="address-level2"
              value={basics.location}
              onChange={(e) =>
                setBasics((b) => ({ ...b, location: e.target.value }))
              }
              placeholder="Amsterdam"
              className="inline-block w-[min(160px,48vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[var(--funnel-accent)] focus:ring-2 focus:ring-[var(--funnel-accent)]/30 sm:px-3 sm:py-1.5"
            />
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-1 text-[10px] text-gray-500 sm:text-[11px]">
          <Lock className="h-3 w-3 shrink-0 text-gray-400" strokeWidth={2.5} aria-hidden />
          <span>Je gegevens blijven privé.</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-canvas px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          disabled={!ok}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
            ok
              ? "bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white shadow-lg"
              : "cursor-not-allowed bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white opacity-50 shadow-none"
          }`}
        >
          Doorgaan →
        </button>
      </div>
    </div>
  );
}

function formatKm(km: number): string {
  const r = Math.round(km * 10) / 10;
  if (Math.abs(Math.round(r) - r) < 0.05) return `${Math.round(r)} km`;
  return `${r} km`;
}

function cardFooterEmojis(
  profile: FunnelMatchPick,
  userVibes: string[],
): [string, string] {
  const ov = sharedVibeEmojis(profile, userVibes, 4);
  if (ov.length >= 2) return [ov[0]!, ov[1]!];
  if (ov.length === 1) {
    const second =
      profile.topEmojis.find((e) => e !== ov[0]) ?? profile.topEmojis[1];
    return [ov[0]!, second];
  }
  return profile.topEmojis;
}

function FunnelFindingTypeScreen({
  peer,
  cardBg,
  variant,
}: {
  peer: FunnelMatchPick;
  cardBg: string;
  variant: AppVariant;
}) {
  const isV2 = variant === "v2";
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = useMemo(
    () => [
      "Op zoek naar jouw type vrouwen…",
      "Vergelijken met jouw voorkeuren…",
      "Bijna klaar — feed wordt klaargezet…",
    ],
    [],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIdx((i) => (i + 1) % statuses.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [statuses.length]);

  return (
    <div className="flex h-full min-h-0 w-full justify-center overflow-hidden overscroll-none touch-manipulation">
      <div
        className={`relative flex h-full min-h-0 w-full max-w-[430px] flex-col items-center justify-center overflow-hidden px-6 ${cardBg}`}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[var(--funnel-accent-soft)]/25 blur-3xl"
          aria-hidden
        />

        <div className="relative mb-8">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[var(--funnel-accent)]/30"
            animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            style={{ margin: -12 }}
            aria-hidden
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-[var(--funnel-accent)]/20"
            animate={{ scale: [1, 1.55, 1], opacity: [0.4, 0, 0.4] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.35,
            }}
            style={{ margin: -20 }}
            aria-hidden
          />
          <div
            className={`relative h-28 w-28 overflow-hidden rounded-full ring-4 shadow-xl ${
              isV2 ? "ring-[var(--funnel-accent)]/40" : "ring-white"
            }`}
          >
            <Image
              src={peer.photo}
              alt=""
              fill
              className="object-cover object-[center_22%]"
              sizes="112px"
              priority
            />
          </div>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-2.5 w-2.5 rounded-full bg-[var(--funnel-accent)] shadow-sm"
              style={{
                top: "50%",
                left: "50%",
                marginTop: -5,
                marginLeft: -5,
              }}
              animate={{
                x: [0, Math.cos((i * 2 * Math.PI) / 3) * 52, 0],
                y: [0, Math.sin((i * 2 * Math.PI) / 3) * 52, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
              aria-hidden
            />
          ))}
        </div>

        <h2
          className={`text-center text-[clamp(1.25rem,4.5vmin,1.5rem)] font-extrabold leading-tight ${
            isV2 ? "text-ink" : "text-gray-900"
          }`}
        >
          Op zoek naar jouw type vrouwen
        </h2>

        <div className="mt-4 h-8 w-full max-w-[280px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={`text-center text-[13px] font-semibold ${
                isV2 ? "text-inkMuted" : "text-gray-600"
              }`}
            >
              {statuses[statusIdx]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex w-full max-w-[200px] flex-col gap-2">
          <div
            className={`h-1.5 overflow-hidden rounded-full ${
              isV2 ? "bg-white/10" : "bg-gray-200"
            }`}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)]"
              initial={{ width: "8%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: FUNNEL_COMPLETE_MIN_MS / 1000,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            />
          </div>
          <p
            className={`text-center text-[11px] ${
              isV2 ? "text-inkMuted" : "text-gray-500"
            }`}
          >
            Even geduld — je feed wordt klaargezet
          </p>
        </div>
      </div>
    </div>
  );
}

function StepPickMatch({
  matches,
  lookingFor,
  userVibes,
  selectedId,
  onSelect,
  onFinish,
}: {
  matches: FunnelMatchPick[];
  lookingFor: FunnelLookingFor | null;
  userVibes: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFinish: () => void;
}) {
  const { variant } = useFunnelConfig();
  const isV2 = variant === "v2";
  const ok = Boolean(selectedId);
  const n = matches.length;
  const intentLabel = funnelLookingForLabel(lookingFor);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-1 pt-1 [-webkit-overflow-scrolling:touch]">
        <div className="px-2 pb-1 pt-0">
          <h2
            className={`text-[clamp(1.15rem,4.2vmin,1.5rem)] font-extrabold leading-tight ${
              isV2 ? "text-ink" : "text-gray-900"
            }`}
          >
            Kies je type vrouw.
          </h2>
          <p
            className={`mt-0.5 text-[clamp(11px,2.9vmin,13px)] ${
              isV2 ? "text-inkMuted" : "text-gray-600"
            }`}
          >
            <span className="font-bold text-[var(--funnel-accent)]">{n} vrouwen</span>{" "}
            <span>
              passen bij jouw keuzes
              {intentLabel ? ` · ${intentLabel}` : ""}. Tik degene die je het meest aanspreekt.
            </span>
          </p>
        </div>
        <div className="grid auto-rows-min grid-cols-2 gap-3 px-2 pb-2 pt-2">
          {matches.map((p) => {
            const sel = selectedId === p.id;
            const [e1, e2] = cardFooterEmojis(p, userVibes);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={sel}
                onClick={() => onSelect(p.id)}
                className={`group relative aspect-[3/4] w-full min-w-0 overflow-hidden rounded-2xl text-left shadow-md ring-2 transition active:scale-[0.98] [transform:translateZ(0)] [isolation:isolate] ${
                  sel
                    ? "ring-[var(--funnel-accent)] ring-offset-2 ring-offset-[#F5F3EE]"
                    : "ring-black/[0.06] ring-offset-0"
                }`}
              >
                <div className="absolute inset-0 bg-gray-200">
                  <Image
                    src={p.photo}
                    alt=""
                    fill
                    className="object-cover object-[center_22%]"
                    sizes="(max-width: 430px) 46vw, 210px"
                    quality={90}
                  />
                </div>

                {/* Light top vignette so badges read; keep face area clear */}
                <div
                  className="pointer-events-none absolute inset-0 z-[10] bg-gradient-to-b from-black/25 via-transparent to-transparent"
                  aria-hidden
                />
                {/* Strong scrim only in lower third for name line */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 top-[52%] z-[12] bg-gradient-to-t from-black/78 via-black/35 to-transparent"
                  aria-hidden
                />

                {sel ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[14] ring-2 ring-inset ring-[var(--funnel-accent)]/90"
                    aria-hidden
                  />
                ) : null}

                <span className="absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-extrabold text-pink-600 shadow-sm ring-1 ring-black/[0.06] backdrop-blur-sm sm:text-[11px]">
                  ✨{p.matchPercent}%
                </span>
                <span
                  className="absolute right-2 top-2 z-20 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm ring-2 ring-white"
                  aria-hidden
                />

                <div className="absolute inset-x-0 bottom-0 z-30 px-2 pb-2 pt-4 text-white sm:px-2.5 sm:pb-2.5 sm:pt-5">
                  <p className="truncate text-[11px] font-extrabold leading-tight drop-shadow-md sm:text-[12px]">
                    {p.name}, {p.age}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-semibold leading-tight text-white/95 drop-shadow sm:text-[10px]">
                    {p.city}
                  </p>
                </div>

                <AnimatePresence>
                  {sel && (
                    <motion.div
                      key={`med-${p.id}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute inset-0 z-[40] flex items-center justify-center bg-[var(--funnel-accent)]/10"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-extrabold text-[var(--funnel-accent)] shadow-lg ring-2 ring-[var(--funnel-accent)]/25 sm:h-11 sm:w-11 sm:text-lg">
                        ✓
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-canvas px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          disabled={!ok}
          onClick={onFinish}
          className={funnelPrimaryButtonClass(ok)}
        >
          Dit is mijn type →
        </button>
      </div>
    </div>
  );
}
