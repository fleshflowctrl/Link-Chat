"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
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
  FUNNEL_LOOKING_FOR,
  FUNNEL_SESSION_KEY,
  ONBOARDED_KEY,
  type FunnelAgeRange,
  type FunnelBasics,
  type FunnelFirstContact,
  type FunnelLookingFor,
} from "@/data/funnel";
import { getThreadMeta } from "@/data/messages";
import { funnelSets, type FunnelWelcomeCard } from "@/data/funnelProfiles";
import { likesPreviewAvatarUrls, profiles as staticCatalogProfiles, type Profile } from "@/data/profiles";
import {
  pickFunnelMatchProfiles,
  sharedVibeEmojis,
  type FunnelMatchPick,
} from "@/lib/funnel-match-picks";
import { setThreadPreview } from "@/lib/thread-preview-store";
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
import { queueFunnelAutoSend } from "@/lib/funnel/auto-send";
import { STARTING_USER_CREDITS } from "@/lib/credits/pricing";
import { withVariantPath } from "@/lib/app-variant";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { SITE_DISPLAY } from "@/lib/brand";

const STEP_TOTAL = 6;
const MSG_MAX = 240;

/** Makes clear: chat works without signup; creating an account is optional. */
function FunnelOptionalSignup({
  signupPath,
  loginPath,
  layout = "full",
}: {
  signupPath: string;
  loginPath: string;
  layout?: "full" | "compact";
}) {
  const { variant } = useFunnelConfig();
  const isV2 = variant === "v2";

  const calloutClass = isV2
    ? "rounded-xl border border-white/10 bg-[#353536] px-3 py-2.5 text-center text-[12px] leading-snug text-inkMuted"
    : "rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-center text-[12px] leading-snug text-gray-600";

  const highlightClass = isV2
    ? "font-semibold text-ink"
    : "font-semibold text-gray-800";

  if (layout === "compact") {
    return (
      <p
        className={`text-center text-[11px] leading-snug ${
          isV2 ? "text-inkMuted" : "text-gray-500"
        }`}
      >
        <span className={highlightClass}>Geen account nodig</span> om te chatten ·{" "}
        <Link
          href={signupPath}
          className="font-semibold text-[var(--funnel-accent)] underline-offset-2 hover:underline"
        >
          Account aanmaken (optioneel)
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className={calloutClass}>
        <p>
          <span className={highlightClass}>Geen account nodig</span> — je kunt meteen
          chatten. Wil je je profiel en gesprekken bewaren? Maak dan optioneel een
          account aan.
        </p>
      </div>
      <Link
        href={signupPath}
        className={`flex w-full items-center justify-center rounded-full py-3 text-[14px] font-bold transition active:scale-95 ${
          isV2
            ? "border border-white/15 bg-[#353536] text-ink ring-1 ring-white/10"
            : "border border-gray-200 bg-white text-gray-800 shadow-sm ring-1 ring-black/[0.06]"
        }`}
      >
        Account aanmaken (optioneel)
      </Link>
      <p
        className={`text-center text-[11px] ${
          isV2 ? "text-inkMuted" : "text-gray-500"
        }`}
      >
        Al een account?{" "}
        <Link
          href={loginPath}
          className="font-semibold text-[var(--funnel-accent)] underline-offset-2 hover:underline"
        >
          Inloggen
        </Link>
      </p>
    </div>
  );
}

type FunnelGender = "man" | "woman";
type FunnelSeekingGender = "men" | "women" | "both";

type FunnelPersist = {
  step: number;
  lookingFor: FunnelLookingFor | null;
  gender: FunnelGender | null;
  seekingGender: FunnelSeekingGender | null;
  ageRange: FunnelAgeRange;
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

const DEFAULT_AGE_RANGE: FunnelAgeRange = {
  min: 18,
  max: 35,
  anyAge: false,
};

function normalizeAgeRange(
  p: Partial<FunnelPersist> & { ageMin?: number; ageMax?: number },
): FunnelAgeRange {
  if (p.ageRange && typeof p.ageRange === "object") {
    const ar = p.ageRange as Partial<FunnelAgeRange>;
    return {
      min:
        typeof ar.min === "number"
          ? Math.min(70, Math.max(18, Math.round(ar.min)))
          : DEFAULT_AGE_RANGE.min,
      max:
        typeof ar.max === "number"
          ? Math.min(70, Math.max(18, Math.round(ar.max)))
          : DEFAULT_AGE_RANGE.max,
      anyAge: Boolean(ar.anyAge),
    };
  }
  const min =
    typeof p.ageMin === "number"
      ? Math.min(70, Math.max(18, Math.round(p.ageMin)))
      : DEFAULT_AGE_RANGE.min;
  const max =
    typeof p.ageMax === "number"
      ? Math.min(70, Math.max(18, Math.round(p.ageMax)))
      : DEFAULT_AGE_RANGE.max;
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
  gender: null,
  seekingGender: null,
  ageRange: { ...DEFAULT_AGE_RANGE },
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
    // Legacy: step 5 was age range (removed); steps 6–8 are now 5–7.
    const step =
      rawStep > 5 ? rawStep - 1 : rawStep === 5 ? 5 : rawStep;

    return {
      ...defaultPersist(),
      ...p,
      lookingFor: lf,
      gender: normalizeGender(p.gender),
      seekingGender: normalizeSeekingGender(p.seekingGender),
      ageRange,
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

export function OnboardingFunnel({
  initialCatalog,
  variant = DEFAULT_APP_VARIANT,
}: {
  initialCatalog?: Profile[];
  variant?: AppVariant;
}) {
  return (
    <FunnelConfigProvider variant={variant}>
      <OnboardingFunnelInner initialCatalog={initialCatalog} />
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
  const [ageRange, setAgeRange] = useState<FunnelAgeRange>(() => ({
    ...DEFAULT_AGE_RANGE,
  }));
  const [basics, setBasics] = useState<FunnelBasics>(() => ({ ...DEFAULT_BASICS }));
  const [firstContact, setFirstContact] = useState<FunnelFirstContact>({
    profileId: null,
  });
  const [firstMessage, setFirstMessage] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const matchAgeMin = ageRange.anyAge ? 18 : ageRange.min;
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
        [],
        lookingFor,
        matchAgeMin,
        matchAgeMax,
      ),
    [funnelCatalog, lookingFor, matchAgeMin, matchAgeMax],
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
        setBasics(saved.basics);
        setFirstContact(saved.firstContact);
        setFirstMessage(saved.firstMessage);
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
      gender,
      seekingGender,
      ageRange,
      basics,
      firstContact,
      firstMessage,
    };
    persistRef.current = p;
    saveSession(p);
  }, [
    step,
    lookingFor,
    gender,
    seekingGender,
    ageRange,
    basics,
    firstContact,
    firstMessage,
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
        gender,
        seekingGender,
        ageRange,
        startingCredits: STARTING_USER_CREDITS,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Opslaan mislukt (${res.status})`);
    }
  }, [ageRange, gender, lookingFor, seekingGender]);

  const finishFunnelToDiscover = useCallback(async () => {
    setFunnelError(null);
    try {
      await persistFunnelDemographics();
      sessionStorage.removeItem(FUNNEL_SESSION_KEY);
      clearLegacyFunnelLocalStorage();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONBOARDED_KEY, "true");
      }
      sessionStorage.setItem(
        "whisper_discover_toast",
        `Welkom bij ${SITE_DISPLAY} ✨`,
      );
      router.push(cfg.discoverPath);
    } catch (e) {
      setFunnelError(
        e instanceof Error ? e.message : "Kon niet doorgaan — probeer opnieuw",
      );
    }
  }, [cfg.discoverPath, persistFunnelDemographics, router]);

  const skipFirstLink = useCallback(() => {
    setFirstContact({ profileId: null });
    setFirstMessage("");
    void finishFunnelToDiscover();
  }, [finishFunnelToDiscover]);

  const startFunnelChat = useCallback(async () => {
    const pid = firstContact.profileId;
    const msgTrim = firstMessage.trim();
    if (!pid || !pickedMatch || !msgTrim) return;

    setFunnelError(null);
    setStartingChat(true);
    try {
      await persistFunnelDemographics();
      queueFunnelAutoSend(pid, msgTrim);

      const meta = getThreadMeta(pid);
      const sentAt = new Date().toISOString();
      setThreadPreview(pid, {
        lastMessage: msgTrim,
        timestampLabel: "nu",
        lastActivityAt: sentAt,
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 0,
      });

      sessionStorage.removeItem(FUNNEL_SESSION_KEY);
      clearLegacyFunnelLocalStorage();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONBOARDED_KEY, "true");
      }

      router.push(withVariantPath(`/messages/${pid}`, cfg.variant));
    } catch (e) {
      setFunnelError(
        e instanceof Error ? e.message : "Chat starten mislukt — probeer opnieuw",
      );
      setStartingChat(false);
    }
  }, [
    cfg.variant,
    firstContact.profileId,
    firstMessage,
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
                <StepGender
                  selected={gender}
                  onSelect={(g) => {
                    setGender(g);
                    setTimeout(() => goNext(), 300);
                  }}
                />
              )}
              {step === 4 && (
                <StepSeekingGender
                  selected={seekingGender}
                  onSelect={(g) => {
                    setSeekingGender(g);
                    setTimeout(() => goNext(), 300);
                  }}
                />
              )}
              {step === 5 && (
                <StepPickMatch
                  matches={matches}
                  selectedId={firstContact.profileId}
                  onSelect={(id) => setFirstContact({ profileId: id })}
                  onContinue={goNext}
                  onSkip={skipFirstLink}
                  signupPath={cfg.signupPath}
                  loginPath={cfg.loginPath}
                />
              )}
              {step === 6 && (
                <StepFirstMessage
                  peer={pickedMatch}
                  value={firstMessage}
                  onChange={setFirstMessage}
                  onContinue={() => void startFunnelChat()}
                  continuing={startingChat}
                  signupPath={cfg.signupPath}
                  loginPath={cfg.loginPath}
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

  const shuffled = [...catalog].sort(() => Math.random() - 0.5);
  const sets: FunnelWelcomeCard[][] = [];
  for (let s = 0; s < setCount; s++) {
    const slice = shuffled.slice(s * perSet, s * perSet + perSet);
    if (slice.length < perSet) break;
    sets.push(slice.map((p, i) => catalogProfileToWelcomeCard(p, i)));
  }
  return sets.length > 0 ? sets : funnelSets;
}

function StepWelcome({
  onStart,
  catalog,
}: {
  onStart: () => void;
  catalog: Profile[];
}) {
  const cfg = useFunnelConfig();
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
    const ctrl = animate(countMv, 12_453, { duration: 1.2, ease: "easeOut" });
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
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full w-[14.3%] rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)]"
              aria-hidden
            />
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-gray-500">1 / 7</span>
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

        <h2 className="mt-2 max-w-[20ch] text-balance text-[clamp(1.35rem,5.2vmin,1.875rem)] font-extrabold leading-tight tracking-tight text-gray-900">
          <span className="block">Vind jouw</span>
          <span className="block">soort mensen.</span>
        </h2>

        <p className="mt-2 text-[clamp(12px,3.2vmin,14px)] leading-snug">
          <span className="text-gray-600">Echte gesprekken. </span>
          <span className="font-bold text-[var(--funnel-accent)]">Op jouw tempo.</span>
        </p>

        <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 max-w-[70%] items-center gap-1.5">
            <div className="flex shrink-0 -space-x-1.5 pl-0.5">
              {likesPreviewAvatarUrls.map((url, i) => (
                <span
                  key={url}
                  className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-[#F5F3EE]"
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
            <p className="min-w-0 text-[11px] leading-snug text-gray-700">
              <span className="font-bold tabular-nums text-gray-900">{countLabel}</span> mensen online nu
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 shadow-sm ring-1 ring-black/[0.06]">
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

        <p className="mt-1.5 text-center text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">Geen account nodig</span> om te
          starten.{" "}
          <Link
            href={cfg.signupPath}
            className="font-bold text-[var(--funnel-accent)] underline-offset-2 hover:underline"
          >
            Account aanmaken
          </Link>{" "}
          is optioneel ·{" "}
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
          <span className="block">Waar kom je</span>
          <span className="block">voor?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          We personaliseren je feed.
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

const GENDER_OPTIONS: {
  id: FunnelGender;
  emoji: string;
  label: string;
  sub: string;
  bg: string;
}[] = [
  { id: "man", emoji: "👨", label: "Man", sub: "Ik identificeer als man", bg: "bg-blue-50" },
  { id: "woman", emoji: "👩", label: "Vrouw", sub: "Ik identificeer als vrouw", bg: "bg-pink-50" },
];

function StepGender({
  selected,
  onSelect,
}: {
  selected: FunnelGender | null;
  onSelect: (g: FunnelGender) => void;
}) {
  const { variant } = useFunnelConfig();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Ben je een</span>
          <span className="block">man of vrouw?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          Dit helpt ons je ervaring te personaliseren.
        </p>
      </div>

      <ul className="mt-3 flex min-h-0 flex-1 flex-col justify-start gap-3">
        {GENDER_OPTIONS.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={funnelChoiceRowClass(variant, isSel, opt.bg)}
              >
                <span className="text-4xl" aria-hidden>{opt.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={funnelOptionTitleClass(variant)}>{opt.label}</span>
                  <span className={funnelOptionSubClassSm(variant)}>{opt.sub}</span>
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

const SEEKING_OPTIONS: { id: FunnelSeekingGender; emoji: string; label: string; sub: string; bg: string }[] = [
  { id: "women", emoji: "👩", label: "Vrouwen", sub: "Toon mij vrouwen", bg: "bg-pink-50" },
  { id: "men", emoji: "👨", label: "Mannen", sub: "Toon mij mannen", bg: "bg-blue-50" },
  { id: "both", emoji: "💫", label: "Beide", sub: "Ik sta open voor iedereen", bg: "bg-purple-50" },
];

function StepSeekingGender({
  selected,
  onSelect,
}: {
  selected: FunnelSeekingGender | null;
  onSelect: (g: FunnelSeekingGender) => void;
}) {
  const { variant } = useFunnelConfig();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className={funnelStepTitleClass(variant)}>
          <span className="block">Wie zoek</span>
          <span className="block">je?</span>
        </h2>
        <p className={funnelStepSubtitleClass(variant)}>
          We matchen je met de juiste mensen.
        </p>
      </div>

      <ul className="mt-3 flex min-h-0 flex-1 flex-col justify-start gap-3">
        {SEEKING_OPTIONS.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={funnelChoiceRowClass(variant, isSel, opt.bg)}
              >
                <span className="text-4xl" aria-hidden>{opt.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={funnelOptionTitleClass(variant)}>{opt.label}</span>
                  <span className={funnelOptionSubClassSm(variant)}>{opt.sub}</span>
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

function StepPickMatch({
  matches,
  selectedId,
  onSelect,
  onContinue,
  onSkip,
  signupPath,
  loginPath,
}: {
  matches: FunnelMatchPick[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  signupPath: string;
  loginPath: string;
}) {
  const userVibes: string[] = [];
  const ok = Boolean(selectedId);
  const n = matches.length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-1 pt-1 [-webkit-overflow-scrolling:touch]">
        <div className="px-2 pb-1 pt-0">
          <h2 className="text-[clamp(1.15rem,4.2vmin,1.5rem)] font-extrabold leading-tight text-gray-900">
            Je eerste match.
          </h2>
          <p className="mt-0.5 text-[clamp(11px,2.9vmin,13px)] text-gray-600">
            <span className="font-bold text-pink-500">{n} mensen</span>{" "}
            <span>online en bij jouw vibe. Kies er één.</span>
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
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
            ok
              ? "bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white shadow-lg"
              : "cursor-not-allowed bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white opacity-50 shadow-none"
          }`}
        >
          Eerste bericht sturen →
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-[var(--funnel-accent)] transition active:scale-[0.98] active:opacity-80"
        >
          Overslaan — ik stuur later een bericht
        </button>
        <div className="mt-2">
          <FunnelOptionalSignup
            signupPath={signupPath}
            loginPath={loginPath}
            layout="compact"
          />
        </div>
      </div>
    </div>
  );
}

function StepFirstMessage({
  peer,
  value,
  onChange,
  onContinue,
  continuing = false,
  signupPath,
  loginPath,
}: {
  peer: FunnelMatchPick | null;
  value: string;
  onChange: (s: string) => void;
  onContinue: () => void;
  continuing?: boolean;
  signupPath: string;
  loginPath: string;
}) {
  const { variant } = useFunnelConfig();
  const isV2 = variant === "v2";
  const ok = value.trim().length > 0;
  const len = value.length;

  const name = peer?.name ?? "jou";
  const starterChips = useMemo(() => [
    `Hé ${name}! Wat doe je meestal in het weekend?`,
    `${name}, ik moet zeggen — je profiel viel me op 👀 waar ben je hier naar op zoek?`,
    `Eerlijk ${name}, jij bent precies mijn type 🔥 wat zou voor jou een perfecte eerste date zijn?`,
  ], [name]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="flex shrink-0 items-center gap-2.5 px-5 pt-3">
        {peer && (
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm sm:h-11 sm:w-11">
            <Image src={peer.photo} alt="" width={88} height={88} className="h-full w-full object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[clamp(1.15rem,4.5vmin,1.75rem)] font-extrabold leading-tight text-gray-900">
            Zeg hallo tegen {peer?.name ?? "…"}
          </h2>
        </div>
      </div>
      <p
        className={`shrink-0 px-5 pt-1 text-[clamp(12px,3.2vmin,14px)] ${
          isV2 ? "text-inkMuted" : "text-gray-600"
        }`}
      >
        Een goed eerste bericht stelt een vraag.{" "}
        <span className={isV2 ? "font-semibold text-ink" : "font-semibold text-gray-800"}>
          Geen account verplicht
        </span>{" "}
        — je gaat daarna meteen naar de chat.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-2 pt-2 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-2">
          {starterChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              className="w-full rounded-2xl bg-white px-3 py-2.5 text-left text-[clamp(11px,2.9vmin,13px)] font-semibold leading-snug text-gray-800 shadow-sm ring-1 ring-black/[0.06] transition active:scale-[0.98]"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MSG_MAX))}
            rows={4}
            className="w-full resize-none rounded-2xl border-0 bg-white p-3 text-[clamp(13px,3.4vmin,15px)] leading-relaxed text-gray-900 shadow-sm ring-1 ring-black/[0.06] outline-none focus:ring-2 focus:ring-[var(--funnel-accent)]/40 sm:p-4"
            placeholder="Schrijf iets aardigs…"
          />
          <p className="mt-1 text-right text-[11px] font-medium text-gray-500">
            {len} / {MSG_MAX}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-canvas px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          disabled={!ok || continuing}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-bold transition active:scale-95 ${
            ok && !continuing
              ? "bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] text-white shadow-pill"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          {continuing ? "Chat openen…" : "Start chat (zonder account) →"}
        </button>
        <div className="mt-3">
          <FunnelOptionalSignup
            signupPath={signupPath}
            loginPath={loginPath}
            layout="full"
          />
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

