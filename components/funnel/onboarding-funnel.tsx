"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
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
  type WhisperUserLocal,
  WHISPER_USER_KEY,
} from "@/data/funnel";
import {
  appendOnboardingOutboundToMockThread,
  getThreadMeta,
} from "@/data/messages";
import { funnelSets } from "@/data/funnelProfiles";
import { likesPreviewAvatarUrls, profiles as staticCatalogProfiles, type Profile } from "@/data/profiles";
import {
  pickFunnelMatchProfiles,
  sharedVibeEmojis,
  type FunnelMatchPick,
} from "@/lib/funnel-match-picks";
import { setThreadPreview } from "@/lib/thread-preview-store";

const STEP_TOTAL = 8;
const MSG_MAX = 240;

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
  location: "London, UK",
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
    return {
      ...defaultPersist(),
      ...p,
      lookingFor: lf,
      gender: normalizeGender(p.gender),
      seekingGender: normalizeSeekingGender(p.seekingGender),
      ageRange,
      basics,
      firstContact,
      step: Math.min(STEP_TOTAL, Math.max(1, Number(p.step) || 1)),
    };
  } catch {
    return null;
  }
}

function saveSession(p: FunnelPersist) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(p));
}

export function OnboardingFunnel({ initialCatalog }: { initialCatalog?: Profile[] }) {
  const router = useRouter();
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
    if (localStorage.getItem(ONBOARDED_KEY) === "true") {
      router.replace("/discover");
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
    setHydrated(true);
  }, [router]);

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

  const goNext = useCallback(() => {
    setNavDir(1);
    setStep((s) => Math.min(STEP_TOTAL, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setNavDir(-1);
    setStep((s) => {
      if (s === 8 && !firstContact.profileId) {
        return 6;
      }
      return Math.max(1, s - 1);
    });
  }, [firstContact.profileId]);

  const progress = (step / STEP_TOTAL) * 100;

  const skipFirstLink = useCallback(() => {
    setNavDir(1);
    setFirstContact({ profileId: null });
    setFirstMessage("");
    setStep(8);
  }, []);

  const completeFunnel = useCallback(
    (via: "google" | "apple" | "email") => {
      const pid = firstContact.profileId;
      const msgTrim = firstMessage.trim();
      const didFirstMessage = Boolean(
        pid && pickedMatch && msgTrim.length >= 10,
      );
      let prevCredits = 0;
      try {
        const prevRaw = localStorage.getItem(WHISPER_USER_KEY);
        if (prevRaw) {
          const prev = JSON.parse(prevRaw) as { credits?: unknown };
          if (typeof prev.credits === "number" && prev.credits >= 0) {
            prevCredits = prev.credits;
          }
        }
      } catch {
        /* ignore */
      }
      const credits = prevCredits + 25;

      const basePayload = {
        name: "User",
        age: 25,
        location: "London, UK",
        vibe: [],
        ageRange,
        lookingFor: lookingFor ?? FUNNEL_LOOKING_FOR[0].id,
        credits,
      } satisfies Omit<WhisperUserLocal, "pickedMatchId" | "firstMessage">;

      const payload: WhisperUserLocal = didFirstMessage
        ? {
            ...basePayload,
            pickedMatchId: pid!,
            firstMessage: msgTrim,
          }
        : { ...basePayload };

      if (didFirstMessage && pid && pickedMatch) {
        appendOnboardingOutboundToMockThread(pid, msgTrim);
        const meta = getThreadMeta(pid);
        const sentAt = new Date().toISOString();
        setThreadPreview(pid, {
          lastMessage: msgTrim,
          timestampLabel: "now",
          lastActivityAt: sentAt,
          name: meta.name,
          avatarUrl: meta.avatarUrl,
          verified: meta.verified,
          showOnlineDot: meta.onlineNow,
          unreadCount: 1,
        });
      }

      localStorage.setItem(WHISPER_USER_KEY, JSON.stringify({ ...payload, signupVia: via }));
      localStorage.setItem(ONBOARDED_KEY, "true");
      sessionStorage.removeItem(FUNNEL_SESSION_KEY);

      const toast = didFirstMessage
        ? `Message sent to ${pickedMatch!.name} ✨`
        : "You're in — welcome to whisper ✨";
      sessionStorage.setItem("whisper_discover_toast", toast);

      router.push("/discover");
    },
    [
      basics,
      ageRange,
      firstContact.profileId,
      firstMessage,
      lookingFor,
      pickedMatch,
      router,
    ],
  );

  const slideVariants = {
    initial: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 28 : -28, opacity: 0 }),
  };

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden overscroll-none bg-[#F5F3EE] touch-manipulation">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 flex justify-center overflow-hidden overscroll-none bg-[#E4DFD4] touch-manipulation">
      <div className="relative flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden overscroll-none bg-[#F5F3EE] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(60,40,20,0.12)] touch-manipulation">
        {step > 1 && (
          <header className="z-20 flex shrink-0 items-center gap-3 border-b border-black/[0.04] bg-[#F5F3EE]/95 px-4 py-2.5 pt-[max(6px,env(safe-area-inset-top))] backdrop-blur-sm">
            <div className="flex w-8 shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-black/[0.06] transition active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF]"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "tween", duration: 0.25 }}
                />
              </div>
            </div>
            <div className="w-9 shrink-0 text-right text-[10px] font-medium text-gray-500">
              {step} / {STEP_TOTAL}
            </div>
          </header>
        )}

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
              {step === 1 && <StepWelcome onStart={goNext} />}
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
                <StepAgeRange
                  ageRange={ageRange}
                  setAgeRange={setAgeRange}
                  onContinue={goNext}
                />
              )}
              {step === 6 && (
                <StepPickMatch
                  matches={matches}
                  selectedId={firstContact.profileId}
                  onSelect={(id) => setFirstContact({ profileId: id })}
                  onContinue={goNext}
                  onSkip={skipFirstLink}
                />
              )}
              {step === 7 && (
                <StepFirstMessage
                  peer={pickedMatch}
                  value={firstMessage}
                  onChange={setFirstMessage}
                  onContinue={goNext}
                />
              )}
              {step === 8 && (
                <StepCreateAccount
                  peer={pickedMatch}
                  firstMessage={firstMessage}
                  onComplete={completeFunnel}
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
    top: "top-[10%]",
    left: "left-[5%]",
    width: 120,
    rotate: -6,
  },
  {
    top: "top-[6%]",
    right: "right-[5%]",
    width: 130,
    rotate: 5,
  },
  {
    top: "top-[30%]",
    left: "left-[9%]",
    width: 105,
    rotate: -3,
  },
  {
    top: "top-[34%]",
    right: "right-[8%]",
    width: 115,
    rotate: 4,
  },
] as const;

function StepWelcome({ onStart }: { onStart: () => void }) {
  const countMv = useMotionValue(0);
  const [countLabel, setCountLabel] = useState("0");
  const [setIndex, setSetIndex] = useState(0);
  const lastInteractRef = useRef(0);

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
      setSetIndex((i) => (i + 1) % funnelSets.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  const activeSet = funnelSets[setIndex] ?? funnelSets[0];

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F5F3EE] font-sans">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#9B7BFF]/30 blur-3xl"
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
              className="h-full w-[12.5%] rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF]"
              aria-hidden
            />
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-gray-500">1 / 8</span>
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
                          Online
                        </span>
                      )}
                      {profile.status === "new" && (
                        <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                          NEW
                        </span>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 pt-7">
                        <p className="text-left text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                          {profile.name}, {profile.age}
                        </p>
                        {profile.distance ? (
                          <p className="mt-0.5 text-left text-[10px] font-medium text-white/85">
                            {profile.distance}
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

      <div className="pointer-events-auto z-20 shrink-0 border-t border-black/[0.04] bg-gradient-to-t from-[#F5F3EE] via-[#F5F3EE] to-[#F5F3EE]/92 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[clamp(0.75rem,2.5vmin,1.25rem)] shadow-[0_-10px_28px_-14px_rgba(60,40,20,0.08)]">
        <h1 className="font-display text-[clamp(2.25rem,9vmin,3rem)] font-semibold lowercase leading-none tracking-tight text-ink">
          whisper
        </h1>

        <h2 className="mt-2 max-w-[20ch] text-balance text-[clamp(1.35rem,5.2vmin,1.875rem)] font-extrabold leading-tight tracking-tight text-gray-900">
          <span className="block">Find your</span>
          <span className="block">kind of people.</span>
        </h2>

        <p className="mt-2 text-[clamp(12px,3.2vmin,14px)] leading-snug">
          <span className="text-gray-600">Real conversations. </span>
          <span className="font-bold text-[#7C5CFF]">At your pace.</span>
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
              <span className="font-bold tabular-nums text-gray-900">{countLabel}</span> connecting now
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
          className="mt-3 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-95"
        >
          Get started →
        </button>

        <p className="mt-1.5 text-center text-[11px] text-gray-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#7C5CFF] underline-offset-2 hover:underline"
          >
            Log in
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
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
          <span className="block">What brings</span>
          <span className="block">you here?</span>
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-gray-600">
          We&apos;ll personalize your feed.
        </p>
      </div>

      <ul className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-[clamp(4px,1.4vmin,10px)] py-1">
        {FUNNEL_LOOKING_FOR.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id} className="min-h-0 shrink">
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`flex w-full min-h-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98] ${opt.cardBg} ${
                  isSel
                    ? "border-2 border-[#7C5CFF] ring-2 ring-[#7C5CFF]/30"
                    : `border ${opt.cardBorder}`
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${opt.tileBg}`}
                  aria-hidden
                >
                  {opt.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[14px] leading-snug text-gray-900">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-600">
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
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] text-[11px] font-bold text-white"
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

const GENDER_OPTIONS: { id: FunnelGender; emoji: string; label: string; sub: string; bg: string; ring: string }[] = [
  { id: "man", emoji: "👨", label: "Man", sub: "I identify as male", bg: "bg-blue-50", ring: "ring-blue-400" },
  { id: "woman", emoji: "👩", label: "Woman", sub: "I identify as female", bg: "bg-pink-50", ring: "ring-pink-400" },
];

function StepGender({
  selected,
  onSelect,
}: {
  selected: FunnelGender | null;
  onSelect: (g: FunnelGender) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
          <span className="block">Are you a</span>
          <span className="block">man or woman?</span>
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-gray-600">
          This helps us personalize your experience.
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
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${opt.bg} ${
                  isSel
                    ? `border-2 border-[#7C5CFF] ring-2 ring-[#7C5CFF]/30`
                    : "border border-gray-200"
                }`}
              >
                <span className="text-4xl" aria-hidden>{opt.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-extrabold text-gray-900">{opt.label}</span>
                  <span className="block text-[12px] text-gray-500">{opt.sub}</span>
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
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] text-[11px] font-bold text-white"
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
  { id: "women", emoji: "👩", label: "Women", sub: "Show me women", bg: "bg-pink-50" },
  { id: "men", emoji: "👨", label: "Men", sub: "Show me men", bg: "bg-blue-50" },
  { id: "both", emoji: "💫", label: "Both", sub: "I'm open to everyone", bg: "bg-purple-50" },
];

function StepSeekingGender({
  selected,
  onSelect,
}: {
  selected: FunnelSeekingGender | null;
  onSelect: (g: FunnelSeekingGender) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 font-sans">
      <div className="shrink-0">
        <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
          <span className="block">Who are you</span>
          <span className="block">looking for?</span>
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-gray-600">
          We&apos;ll match you with the right people.
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
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${opt.bg} ${
                  isSel
                    ? "border-2 border-[#7C5CFF] ring-2 ring-[#7C5CFF]/30"
                    : "border border-gray-200"
                }`}
              >
                <span className="text-4xl" aria-hidden>{opt.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-extrabold text-gray-900">{opt.label}</span>
                  <span className="block text-[12px] text-gray-500">{opt.sub}</span>
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
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] text-[11px] font-bold text-white"
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

const AGE_LO = 18;
const AGE_HI = 70;
const MIN_GAP = 2;

function ageToPct(v: number): number {
  return ((v - AGE_LO) / (AGE_HI - AGE_LO)) * 100;
}

function formatMaxLabel(max: number): string {
  return max >= AGE_HI ? "70+" : String(max);
}

function fakePeopleCount(min: number, max: number): number {
  const totalSpan = AGE_HI - AGE_LO; // 52 years
  const selectedSpan = Math.max(0, max - min);
  return Math.round((selectedSpan / totalSpan) * 13_780);
}

function StepAgeRange({
  ageRange,
  setAgeRange,
  onContinue,
}: {
  ageRange: FunnelAgeRange;
  setAgeRange: Dispatch<SetStateAction<FunnelAgeRange>>;
  onContinue: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);
  const beforeAnyRef = useRef({ min: 18, max: 35 });

  const readClientXToAge = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return AGE_LO;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(AGE_LO + t * (AGE_HI - AGE_LO));
  };

  const startDrag = (which: "min" | "max") => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (ageRange.anyAge) return;
    e.preventDefault();
    dragging.current = which;

    const onMove = (ev: PointerEvent) => {
      if (dragging.current !== which) return;
      const v = readClientXToAge(ev.clientX);
      setAgeRange((prev) => {
        if (prev.anyAge) return prev;
        if (which === "min") {
          const min = Math.max(AGE_LO, Math.min(v, prev.max - MIN_GAP));
          return { ...prev, min };
        }
        const max = Math.min(AGE_HI, Math.max(v, prev.min + MIN_GAP));
        return { ...prev, max };
      });
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const { min, max, anyAge } = ageRange;
  const pMin = ageToPct(min);
  const pMax = ageToPct(max);
  const countLabel = `~${fakePeopleCount(min, max).toLocaleString()} people in this range`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="shrink-0 px-5 pt-1">
        <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
          <span className="block">Who do you</span>
          <span className="block">want to meet?</span>
        </h2>
        <p className="mt-1 text-[14px] text-gray-600">
          Drag the handles to set an age range.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-2">
        <div className="flex w-full max-w-full flex-col gap-y-[clamp(1rem,3.5vmin,1.75rem)]">
          <div className="rounded-3xl bg-gradient-to-br from-[#EDE7FF] to-[#FDE4F0] p-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7C5CFF]">
              Looking for ages
            </p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums text-gray-900">
              {anyAge ? "~13,780" : `${min} – ${formatMaxLabel(max)}`}
            </p>
            <p className="mt-1 text-[12px] text-gray-600">
              {anyAge ? "people · any age" : countLabel}
            </p>
          </div>

          <div>
            <div
              className={`relative h-10 px-2 touch-none ${anyAge ? "pointer-events-none opacity-50" : ""}`}
            >
              <div
                ref={trackRef}
                className="absolute left-2 right-2 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200"
              >
                <div
                  className="absolute inset-y-0 bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF]"
                  style={{
                    left: `${pMin}%`,
                    width: `${Math.max(0, pMax - pMin)}%`,
                  }}
                />
              </div>

              <button
                type="button"
                aria-label="Minimum age"
                disabled={anyAge}
                onPointerDown={startDrag("min")}
                className="absolute top-1/2 z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-[#7C5CFF] disabled:cursor-not-allowed"
                style={{ left: `calc(0.5rem + (100% - 1rem) * ${pMin / 100})` }}
              />
              <button
                type="button"
                aria-label="Maximum age"
                disabled={anyAge}
                onPointerDown={startDrag("max")}
                className="absolute top-1/2 z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-[#7C5CFF] disabled:cursor-not-allowed"
                style={{ left: `calc(0.5rem + (100% - 1rem) * ${pMax / 100})` }}
              />
            </div>

            <div className="mt-1 flex justify-between px-2 text-[11px] text-gray-400">
              <span>18</span>
              <span>30</span>
              <span>50</span>
              <span>70+</span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={anyAge}
            onClick={() => {
              setAgeRange((prev) => {
                if (prev.anyAge) {
                  return { ...beforeAnyRef.current, anyAge: false };
                }
                beforeAnyRef.current = { min: prev.min, max: prev.max };
                return { min: AGE_LO, max: AGE_HI, anyAge: true };
              });
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm transition active:scale-[0.99]"
          >
            <div className="min-w-0 text-left">
              <p className="text-[14px] font-bold text-gray-900">Open to any age</p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                Show me everyone — I&apos;ll filter later
              </p>
            </div>
            <div
              className="relative shrink-0 rounded-full transition-colors duration-200"
              style={{
                width: 48,
                height: 28,
                backgroundColor: anyAge ? "#7C5CFF" : "#D1D5DB",
              }}
            >
              <div
                className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-md transition-transform duration-200"
                style={{ transform: anyAge ? "translateX(23px)" : "translateX(3px)" }}
              />
            </div>
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-[#F5F3EE] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          onClick={onContinue}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-95"
        >
          Continue →
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
          <span className="block">Tell us</span>
          <span className="block">about you</span>
        </h2>
        <p className="mt-1 text-[clamp(12px,3.2vmin,14px)] text-gray-600">
          Just a few quick things.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-y-[clamp(0.5rem,2vmin,1.25rem)] overflow-hidden px-5 py-1">
        <div className="min-h-0 w-full space-y-[clamp(0.75rem,2.5vmin,1.25rem)] text-[clamp(15px,3.8vmin,18px)] leading-relaxed text-gray-900">
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>I&apos;m</span>
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
              placeholder="Emily"
              className="inline-block w-[min(140px,42vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/30 sm:px-3 sm:py-1.5"
            />
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>I&apos;m</span>
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
              className="inline-block w-[min(80px,22vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-center text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/30 sm:px-3 sm:py-1.5"
            />
            <span>years old.</span>
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
            <span>I live in</span>
            <input
              autoComplete="address-level2"
              value={basics.location}
              onChange={(e) =>
                setBasics((b) => ({ ...b, location: e.target.value }))
              }
              placeholder="London"
              className="inline-block w-[min(160px,48vw)] rounded-full border-2 border-gray-200 bg-white px-2.5 py-1 text-[clamp(14px,3.6vmin,16px)] font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/30 sm:px-3 sm:py-1.5"
            />
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-1 text-[10px] text-gray-500 sm:text-[11px]">
          <Lock className="h-3 w-3 shrink-0 text-gray-400" strokeWidth={2.5} aria-hidden />
          <span>Your details stay private.</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-[#F5F3EE] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          disabled={!ok}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
            ok
              ? "bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white shadow-lg"
              : "cursor-not-allowed bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white opacity-50 shadow-none"
          }`}
        >
          Continue →
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
}: {
  matches: FunnelMatchPick[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const userVibes: string[] = [];
  const ok = Boolean(selectedId);
  const n = matches.length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-1 pt-1 [-webkit-overflow-scrolling:touch]">
        <div className="px-2 pb-1 pt-0">
          <h2 className="text-[clamp(1.15rem,4.2vmin,1.5rem)] font-extrabold leading-tight text-gray-900">
            Your first link.
          </h2>
          <p className="mt-0.5 text-[clamp(11px,2.9vmin,13px)] text-gray-600">
            <span className="font-bold text-pink-500">{n} people</span>{" "}
            <span>online and matched to you. Pick one.</span>
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
                    ? "ring-[#7C5CFF] ring-offset-2 ring-offset-[#F5F3EE]"
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
                    className="pointer-events-none absolute inset-0 z-[14] ring-2 ring-inset ring-[#7C5CFF]/90"
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
                      className="absolute inset-0 z-[40] flex items-center justify-center bg-[#7C5CFF]/10"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-extrabold text-[#7C5CFF] shadow-lg ring-2 ring-[#7C5CFF]/25 sm:h-11 sm:w-11 sm:text-lg">
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

      <div className="shrink-0 border-t border-black/[0.04] bg-[#F5F3EE] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          disabled={!ok}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
            ok
              ? "bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white shadow-lg"
              : "cursor-not-allowed bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white opacity-50 shadow-none"
          }`}
        >
          Send first message →
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-[#7C5CFF] transition active:scale-[0.98] active:opacity-80"
        >
          Skip — I&apos;ll message later
        </button>
      </div>
    </div>
  );
}

function StepFirstMessage({
  peer,
  value,
  onChange,
  onContinue,
}: {
  peer: FunnelMatchPick | null;
  value: string;
  onChange: (s: string) => void;
  onContinue: () => void;
}) {
  const ok = value.trim().length >= 10;
  const len = value.length;

  const name = peer?.name ?? "you";
  const starterChips = useMemo(() => [
    `Hey ${name}! What do you usually do on weekends?`,
    `${name}, I have to say — your profile caught my eye 👀 what are you looking for on here?`,
    `Not gonna lie ${name}, you're exactly my type 🔥 what would be your idea of a perfect first date?`,
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
            Say hi to {peer?.name ?? "…"}
          </h2>
        </div>
      </div>
      <p className="shrink-0 px-5 pt-1 text-[clamp(12px,3.2vmin,14px)] text-gray-600">
        A great first message asks a question.
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
            className="w-full resize-none rounded-2xl border-0 bg-white p-3 text-[clamp(13px,3.4vmin,15px)] leading-relaxed text-gray-900 shadow-sm ring-1 ring-black/[0.06] outline-none focus:ring-2 focus:ring-[#7C5CFF]/40 sm:p-4"
            placeholder="Write something kind…"
          />
          <p className="mt-1 text-right text-[11px] font-medium text-gray-500">
            {len} / {MSG_MAX}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.04] bg-[#F5F3EE] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          disabled={!ok}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-bold transition active:scale-95 ${
            ok
              ? "bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white shadow-pill"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          Send message →
        </button>
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

function isValidEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function StepCreateAccount({
  peer,
  firstMessage,
  onComplete,
}: {
  peer: FunnelMatchPick | null;
  firstMessage: string;
  onComplete: (via: "google" | "apple" | "email") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailOk = isValidEmail(email);
  const passOk = password.length >= 8;
  const formOk = emailOk && passOk;

  const preview = firstMessage.trim();
  const hasOutreach = Boolean(peer && preview.length > 0);
  const quoted =
    preview.length > 0
      ? preview.length > 120
        ? `\u201c${preview.slice(0, 117)}\u2026\u201d`
        : `\u201c${preview}\u201d`
      : "\u201c\u2026\u201d";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-1">
        <h2 className="shrink-0 text-[clamp(1.35rem,5vmin,1.875rem)] font-extrabold leading-tight text-gray-900">
          Almost there <span className="text-amber-400">✨</span>
        </h2>
        <p className="mt-0.5 shrink-0 text-[clamp(12px,3.2vmin,14px)] text-gray-600">
          {hasOutreach
            ? "Save your profile + send your first message."
            : "Save your profile — you can message anyone from Discover."}
        </p>

        <div className="mt-3 flex min-h-0 flex-1 flex-col justify-start gap-y-3 overflow-hidden">
          <div className="relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#EDE7FF] via-[#FDE4F0] to-[#EDE7FF] p-3 shadow-sm sm:p-4">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40 blur-2xl"
              aria-hidden
            />

            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <div className="relative h-10 w-10 shrink-0 sm:h-12 sm:w-12">
                <span className="block h-full w-full overflow-hidden rounded-full bg-white ring-2 ring-white">
                  {peer ? (
                    <Image
                      src={peer.photo}
                      alt=""
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#7C5CFF]/20 to-[#9B7BFF]/30 text-lg" aria-hidden>
                      ✨
                    </span>
                  )}
                </span>
                {peer ? (
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 sm:h-3 sm:w-3"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#7C5CFF] sm:text-[10px]">
                  {hasOutreach ? "READY TO SEND" : "YOUR PROFILE"}
                </p>
                <p className="mt-0.5 truncate text-[clamp(11px,3vmin,13px)] font-semibold text-gray-900">
                  {hasOutreach ? quoted : "Browse profiles and start a chat when you’re ready."}
                </p>
                <p className="mt-0.5 text-[9px] text-gray-500 sm:text-[10px]">
                  {hasOutreach && peer
                    ? `→ to ${peer.name}`
                    : "No first message queued — totally fine."}
                </p>
              </div>
            </div>

            <div className="relative my-2 border-t border-white/60 sm:my-3" />

            <div className="relative space-y-1 sm:space-y-1.5">
              {hasOutreach ? (
                <div className="flex items-center gap-2 text-[clamp(10px,2.8vmin,12px)] text-gray-800">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] text-[9px] text-white sm:h-5 sm:w-5 sm:text-[10px]">
                    ✓
                  </span>
                  <span>Send your first message instantly</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[clamp(10px,2.8vmin,12px)] text-gray-800">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] text-[9px] text-white sm:h-5 sm:w-5 sm:text-[10px]">
                    ✓
                  </span>
                  <span>Discover people matched to your vibe</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[clamp(10px,2.8vmin,12px)] text-gray-800">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[9px] text-white sm:h-5 sm:w-5 sm:text-[10px]">
                  ✓
                </span>
                <span>
                  <b className="text-amber-700">25 free credits</b> on us 💰
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-2.5">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 shadow-sm transition focus-within:border-[#7C5CFF] focus-within:ring-2 focus-within:ring-[#7C5CFF]/20">
              <svg
                className="h-4 w-4 shrink-0 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-12 w-full border-0 bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
                autoComplete="email"
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 shadow-sm transition focus-within:border-[#7C5CFF] focus-within:ring-2 focus-within:ring-[#7C5CFF]/20">
              <svg
                className="h-4 w-4 shrink-0 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-12 w-full border-0 bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="z-20 shrink-0 border-t border-black/[0.04] bg-[#F5F3EE] px-5 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3">
        <button
          type="button"
          disabled={!formOk}
          onClick={() => onComplete("email")}
          className={`flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-extrabold transition active:scale-95 ${
            formOk
              ? "bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white shadow-lg"
              : "cursor-not-allowed bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white opacity-50 shadow-none"
          }`}
        >
          {hasOutreach ? "Create account & send →" : "Create account →"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-snug text-gray-500">
          By continuing you agree to our{" "}
          <Link href="/me/help" className="font-bold text-[#7C5CFF] hover:underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/me/privacy" className="font-bold text-[#7C5CFF] hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
