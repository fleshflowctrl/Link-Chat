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
  type SetStateAction,
} from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  FUNNEL_LOOKING_FOR,
  FUNNEL_SESSION_KEY,
  FUNNEL_STARTER_MESSAGES,
  FUNNEL_VIBES,
  ONBOARDED_KEY,
  type FunnelLookingFor,
  type WhisperUserLocal,
  WHISPER_USER_KEY,
} from "@/data/funnel";
import {
  appendOnboardingOutboundToMockThread,
  getThreadMeta,
} from "@/data/messages";
import { getProfileById, likesPreviewAvatarUrls } from "@/data/profiles";
import {
  pickFunnelMatchProfiles,
  sharedVibeEmojis,
  type FunnelMatchPick,
} from "@/lib/funnel-match-picks";
import { setThreadPreview } from "@/lib/thread-preview-store";

const STEP_TOTAL = 8;
const MSG_MAX = 240;

type FunnelPersist = {
  step: number;
  lookingFor: FunnelLookingFor | null;
  vibes: string[];
  ageMin: number;
  ageMax: number;
  name: string;
  age: string;
  location: string;
  pickedMatchId: string | null;
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

const defaultPersist = (): FunnelPersist => ({
  step: 1,
  lookingFor: null,
  vibes: ["caring", "warm", "listener"],
  ageMin: 18,
  ageMax: 35,
  name: "",
  age: "",
  location: "London, UK",
  pickedMatchId: null,
  firstMessage: "",
});

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
    return {
      ...defaultPersist(),
      ...p,
      lookingFor: lf,
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

export function OnboardingFunnel() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [navDir, setNavDir] = useState(1);
  const persistRef = useRef<FunnelPersist>(defaultPersist());
  const step2Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lookingFor, setLookingFor] = useState<FunnelLookingFor | null>(null);
  const [vibes, setVibes] = useState<string[]>(() => defaultPersist().vibes);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(35);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("London, UK");
  const [pickedMatchId, setPickedMatchId] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState("");

  const matches = useMemo(
    () => pickFunnelMatchProfiles(vibes, ageMin, ageMax),
    [vibes, ageMin, ageMax],
  );

  const pickedMatch = useMemo(
    () => matches.find((m) => m.id === pickedMatchId) ?? null,
    [matches, pickedMatchId],
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
      setVibes(saved.vibes);
      setAgeMin(saved.ageMin);
      setAgeMax(saved.ageMax);
      setName(saved.name);
      setAge(saved.age);
      setLocation(saved.location);
      setPickedMatchId(saved.pickedMatchId);
      setFirstMessage(saved.firstMessage);
    }
    setHydrated(true);
  }, [router]);

  const persistNow = useCallback(() => {
    const p: FunnelPersist = {
      step,
      lookingFor,
      vibes,
      ageMin,
      ageMax,
      name,
      age,
      location,
      pickedMatchId,
      firstMessage,
    };
    persistRef.current = p;
    saveSession(p);
  }, [
    step,
    lookingFor,
    vibes,
    ageMin,
    ageMax,
    name,
    age,
    location,
    pickedMatchId,
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
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const progress = (step / STEP_TOTAL) * 100;

  const completeFunnel = useCallback(
    (via: "google" | "apple" | "email") => {
      if (!pickedMatchId || !pickedMatch) return;
      const ageNum = parseInt(age, 10);
      if (!name.trim() || !Number.isFinite(ageNum)) return;

      const payload: WhisperUserLocal = {
        name: name.trim(),
        age: ageNum,
        location: location.trim() || "London, UK",
        vibe: vibes,
        ageMin,
        ageMax,
        lookingFor: lookingFor ?? FUNNEL_LOOKING_FOR[0].id,
        pickedMatchId,
        firstMessage: firstMessage.trim(),
      };

      appendOnboardingOutboundToMockThread(pickedMatchId, firstMessage.trim());

      const meta = getThreadMeta(pickedMatchId);
      const sentAt = new Date().toISOString();
      setThreadPreview(pickedMatchId, {
        lastMessage: firstMessage.trim(),
        timestampLabel: "now",
        lastActivityAt: sentAt,
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 1,
      });

      localStorage.setItem(WHISPER_USER_KEY, JSON.stringify({ ...payload, signupVia: via }));
      localStorage.setItem(ONBOARDED_KEY, "true");
      sessionStorage.removeItem(FUNNEL_SESSION_KEY);

      const toast = `Message sent to ${pickedMatch.name} ✨`;
      sessionStorage.setItem("whisper_discover_toast", toast);

      router.push("/discover");
    },
    [
      age,
      ageMax,
      ageMin,
      firstMessage,
      location,
      lookingFor,
      name,
      pickedMatch,
      pickedMatchId,
      router,
      vibes,
    ],
  );

  const slideVariants = {
    initial: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 28 : -28, opacity: 0 }),
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F3EE]">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] justify-center overflow-hidden bg-[#E4DFD4]">
      <div className="relative flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-[#F5F3EE] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(60,40,20,0.12)]">
        {step > 1 && (
          <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-black/[0.04] bg-[#F5F3EE]/95 px-4 py-2.5 pt-[max(6px,env(safe-area-inset-top))] backdrop-blur-sm">
            <div className="flex w-8 shrink-0 items-center justify-center">
              {step < 8 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-black/[0.06] transition active:scale-95"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              ) : (
                <span className="h-8 w-8 shrink-0" aria-hidden />
              )}
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
              className="absolute inset-0 flex flex-col overflow-y-auto overscroll-y-contain"
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
                <StepVibes
                  vibes={vibes}
                  setVibes={setVibes}
                  onContinue={goNext}
                />
              )}
              {step === 4 && (
                <StepAgeRange
                  ageMin={ageMin}
                  ageMax={ageMax}
                  setAgeMin={setAgeMin}
                  setAgeMax={setAgeMax}
                  onContinue={goNext}
                />
              )}
              {step === 5 && (
                <StepBasics
                  name={name}
                  setName={setName}
                  age={age}
                  setAge={setAge}
                  location={location}
                  setLocation={setLocation}
                  onContinue={goNext}
                />
              )}
              {step === 6 && (
                <StepPickMatch
                  matches={matches}
                  userVibes={vibes}
                  selectedId={pickedMatchId}
                  onSelect={setPickedMatchId}
                  onContinue={goNext}
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
                <StepCreateAccount peer={pickedMatch} onComplete={completeFunnel} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const HERO_FLOAT = {
  repeat: Infinity,
  repeatType: "mirror" as const,
  ease: "easeInOut" as const,
};

function StepWelcome({ onStart }: { onStart: () => void }) {
  const countMv = useMotionValue(0);
  const [countLabel, setCountLabel] = useState("0");

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

  const maya = getProfileById("maya");
  const marcus = getProfileById("marcus");
  const clara = getProfileById("clara");

  return (
    <div className="relative min-h-[100dvh] min-h-screen w-full overflow-hidden bg-[#F5F3EE] font-sans">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#9B7BFF]/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-pink-300/40 blur-3xl"
        aria-hidden
      />

      <div className="sticky top-3 z-30 flex items-center gap-3 pl-5 pr-5 pt-[max(4px,env(safe-area-inset-top))]">
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
        className="pointer-events-none absolute inset-x-0 top-[52px] z-10 h-[min(52vh,420px)] max-[375px]:h-[48vh]"
        aria-hidden
      >
        {maya && (
          <motion.div
            className="absolute left-[2%] top-[2%] w-[30%] max-w-[118px] min-[376px]:top-[3%]"
            animate={{
              y: [0, -8, 0],
              rotate: [-6, -4, -6],
            }}
            transition={{ ...HERO_FLOAT, duration: 4.8 }}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-xl">
              <Image
                src={maya.photo}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Online
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-8">
                <p className="text-[13px] font-bold leading-tight text-white">
                  {maya.name}, {maya.age}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/85">2 km</p>
              </div>
            </div>
          </motion.div>
        )}

        {marcus && (
          <motion.div
            className="absolute right-[1%] top-0 w-[31%] max-w-[120px] min-[376px]:-top-[1%]"
            animate={{
              y: [0, -6, 0],
              rotate: [5, 7, 5],
            }}
            transition={{ ...HERO_FLOAT, duration: 5.2 }}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-xl">
              <Image
                src={marcus.photo}
                alt=""
                fill
                className="object-cover"
                sizes="120px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                NEW
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-8">
                <p className="text-[13px] font-bold leading-tight text-white">
                  {marcus.name}, {marcus.age}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/85">5 km</p>
              </div>
            </div>
          </motion.div>
        )}

        {clara && (
          <motion.div
            className="absolute bottom-[8%] right-[4%] w-[28%] max-w-[112px] max-[375px]:bottom-[6%]"
            animate={{
              y: [0, -10, 0],
              rotate: [-3, -1, -3],
            }}
            transition={{ ...HERO_FLOAT, duration: 4.5 }}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-xl">
              <Image
                src={clara.photo}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-8">
                <p className="text-[13px] font-bold leading-tight text-white">
                  {clara.name}, 24
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/85">1.1 km</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] h-[min(52vh,400px)] bg-gradient-to-t from-[#F5F3EE] from-20% via-[#F5F3EE]/95 via-55% to-transparent"
        aria-hidden
      />

      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16">
        <h1 className="font-display text-5xl font-semibold lowercase leading-none tracking-tight text-ink">
          whisper
        </h1>

        <h2 className="mt-3 max-w-[20ch] text-balance text-3xl font-extrabold leading-tight tracking-tight text-gray-900">
          <span className="block">Find your</span>
          <span className="block">kind of people.</span>
        </h2>

        <p className="mt-3 text-[15px] leading-snug">
          <span className="text-gray-600">Real conversations. </span>
          <span className="font-bold text-[#7C5CFF]">At your pace.</span>
        </p>

        <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <div className="flex min-w-0 max-w-[72%] items-center gap-2">
            <div className="flex shrink-0 -space-x-2 pl-1">
              {likesPreviewAvatarUrls.map((url, i) => (
                <span
                  key={url}
                  className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-[#F5F3EE]"
                  style={{ zIndex: 3 - i }}
                >
                  <Image
                    src={url}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
            <p className="min-w-0 text-[12px] leading-snug text-gray-700">
              <span className="font-bold tabular-nums text-gray-900">{countLabel}</span>{" "}
              connecting right now
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-black/[0.06]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[11px] font-semibold text-green-600">Live</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-4 text-[16px] font-extrabold text-white shadow-lg transition active:scale-95"
        >
          Get started
          <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.5} />
        </button>

        <p className="mt-3 text-center text-[12px] text-gray-500">
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
    <div className="flex flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 font-sans">
      <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
        <span className="block">What brings</span>
        <span className="block">you here?</span>
      </h2>
      <p className="mt-1 text-[14px] text-gray-600">We&apos;ll personalize your feed.</p>
      <ul className="mt-6 flex flex-col space-y-2.5">
        {FUNNEL_LOOKING_FOR.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98] ${opt.cardBg} ${
                  isSel
                    ? "border-2 border-[#7C5CFF] ring-2 ring-[#7C5CFF]/30"
                    : `border ${opt.cardBorder}`
                }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${opt.tileBg}`}
                  aria-hidden
                >
                  {opt.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[15px] text-gray-900">{opt.label}</span>
                  <span className="mt-0.5 block text-[12px] text-gray-600">{opt.description}</span>
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

function StepVibes({
  vibes,
  setVibes,
  onContinue,
}: {
  vibes: string[];
  setVibes: Dispatch<SetStateAction<string[]>>;
  onContinue: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const toggle = (id: string) => {
    setVibes((prev) => {
      const adding = !prev.includes(id);
      const next = adding ? [...prev, id] : prev.filter((x) => x !== id);
      if (adding && next.length === 8) {
        if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
        setToast("Up to 8 keeps your matches sharp");
        toastTimer.current = window.setTimeout(() => {
          setToast(null);
          toastTimer.current = null;
        }, 2600);
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const n = vibes.length;
  const ok = n >= 3;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-1 font-sans">
        <h2 className="text-balance text-3xl font-extrabold leading-tight text-gray-900">
          <span className="block">What&apos;s your</span>
          <span className="block">vibe?</span>
        </h2>
        <p className="mt-1 text-[14px] text-gray-600">Pick the ones that feel like you.</p>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {FUNNEL_VIBES.map((v) => {
            const on = vibes.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl p-3 transition active:scale-95 ${
                  on
                    ? `${v.selectedBg} ring-2 ${v.selectedRing}`
                    : "bg-white shadow-sm"
                }`}
              >
                <span className="text-3xl" aria-hidden>
                  {v.emoji}
                </span>
                <span className="mt-1 text-center text-[12px] font-bold leading-tight text-gray-900">
                  {v.label}
                </span>
                <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center">
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        key="c"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 28 }}
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-[#7C5CFF] text-[9px] font-bold text-white"
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-black/[0.04] bg-[#F5F3EE]/95 px-5 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          Continue · {n} picked
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl bg-gray-900/90 px-4 py-2.5 text-center text-[13px] font-medium leading-snug text-white shadow-lg"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}

function StepAgeRange({
  ageMin,
  ageMax,
  setAgeMin,
  setAgeMax,
  onContinue,
}: {
  ageMin: number;
  ageMax: number;
  setAgeMin: (n: number) => void;
  setAgeMax: (n: number) => void;
  onContinue: () => void;
}) {
  const onMin = (v: number) => {
    const next = Math.min(v, ageMax - 1);
    setAgeMin(Math.max(18, next));
  };
  const onMax = (v: number) => {
    const next = Math.max(v, ageMin + 1);
    setAgeMax(Math.min(55, next));
  };

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-28 pt-5">
        <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">Who do you want to meet?</h2>
        <p className="mt-1 text-[14px] text-gray-600">Pick an age range.</p>
        <p className="mt-10 text-center text-[42px] font-extrabold tabular-nums text-gray-900">
          {ageMin} – {ageMax}
        </p>
        <div className="mt-8 space-y-6 px-1">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Minimum age
            </label>
            <input
              type="range"
              min={18}
              max={Math.max(18, ageMax - 1)}
              value={ageMin}
              onChange={(e) => onMin(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[#7C5CFF]"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Maximum age
            </label>
            <input
              type="range"
              min={Math.min(55, ageMin + 1)}
              max={55}
              value={ageMax}
              onChange={(e) => onMax(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[#7C5CFF]"
            />
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-black/[0.04] bg-[#F5F3EE]/95 px-5 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onContinue}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-3.5 text-[15px] font-bold text-white shadow-pill transition active:scale-95"
        >
          Continue
        </button>
      </div>
    </>
  );
}

function StepBasics({
  name,
  setName,
  age,
  setAge,
  location,
  setLocation,
  onContinue,
}: {
  name: string;
  setName: (s: string) => void;
  age: string;
  setAge: (s: string) => void;
  location: string;
  setLocation: (s: string) => void;
  onContinue: () => void;
}) {
  const ok = name.trim().length > 0 && age.trim().length > 0 && !Number.isNaN(parseInt(age, 10));

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-28 pt-5">
        <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">A bit about you</h2>
        <p className="mt-1 text-[14px] text-gray-600">Just the essentials.</p>
        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
          <label className="block px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border-0 bg-transparent text-[16px] font-semibold text-gray-900 outline-none ring-0 placeholder:text-gray-400"
              placeholder="Your first name"
              autoComplete="given-name"
            />
          </label>
          <div className="h-px bg-gray-100" />
          <label className="block px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={18}
              max={99}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 block w-full border-0 bg-transparent text-[16px] font-semibold text-gray-900 outline-none"
              placeholder="e.g. 26"
            />
          </label>
          <div className="h-px bg-gray-100" />
          <label className="flex items-start gap-2 px-4 py-3">
            <MapPin className="mt-2 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full border-0 bg-transparent text-[16px] font-semibold text-gray-900 outline-none"
                placeholder="City"
              />
            </span>
          </label>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-black/[0.04] bg-[#F5F3EE]/95 px-5 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          Continue
        </button>
      </div>
    </>
  );
}

function StepPickMatch({
  matches,
  userVibes,
  selectedId,
  onSelect,
  onContinue,
}: {
  matches: FunnelMatchPick[];
  userVibes: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
  const ok = Boolean(selectedId);
  const distances = ["1.2 km away", "2.4 km away", "3.1 km away"];

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-32 pt-5">
        <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">Your first link</h2>
        <p className="mt-1 text-[14px] text-gray-600">
          <span className="font-bold text-pink-500">3 people are online</span> and look like a great fit for you.
        </p>
        <div className="mt-6 flex flex-col gap-4">
          {matches.map((p, idx) => {
            const em = sharedVibeEmojis(p, userVibes, 2);
            const vibeLine =
              em.length >= 2
                ? `You both love ${em[0]} + ${em[1]}`
                : em.length === 1
                  ? `You both love ${em[0]}`
                  : "You share a similar vibe";
            const sel = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={`relative w-full overflow-hidden rounded-2xl text-left shadow-md ring-4 transition active:scale-[0.99] ${
                  sel ? "ring-[#7C5CFF]" : "ring-transparent ring-offset-0"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-gray-200">
                  <Image src={p.photo} alt="" fill className="object-cover" sizes="(max-width:430px) 100vw, 430px" />
                  <span className="absolute left-3 top-3 rounded-full bg-emerald-500/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    Online now
                  </span>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-0.5 rounded-full bg-pink-500/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                    Match {p.matchPercent}%
                  </span>
                  {sel && (
                    <span className="absolute right-3 bottom-24 flex h-7 w-7 items-center justify-center rounded-full bg-[#7C5CFF] text-white shadow-md">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-4 pt-16 text-white">
                    <p className="text-[20px] font-extrabold leading-tight">
                      {p.name}, {p.age}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-white/90">{distances[idx] ?? "Nearby"}</p>
                    <p className="mt-1 text-[13px] font-medium text-white/85">{vibeLine}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-black/[0.04] bg-[#F5F3EE]/95 px-5 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          Send first message →
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          Don&apos;t worry, you can browse everyone after.
        </p>
      </div>
    </>
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

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-32 pt-5">
        <div className="flex items-center gap-3">
          {peer && (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
              <Image src={peer.photo} alt="" width={88} height={88} className="h-full w-full object-cover" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">
              Say hi to {peer?.name ?? "…"}
            </h2>
          </div>
        </div>
        <p className="mt-2 text-[14px] text-gray-600">A great first message asks a question.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {FUNNEL_STARTER_MESSAGES.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(chip)}
              className="rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-gray-800 shadow-sm ring-1 ring-black/[0.06] transition active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MSG_MAX))}
            rows={5}
            className="w-full resize-none rounded-2xl border-0 bg-white p-4 text-[15px] leading-relaxed text-gray-900 shadow-sm ring-1 ring-black/[0.06] outline-none focus:ring-2 focus:ring-[#7C5CFF]/40"
            placeholder="Write something kind…"
          />
          <p className="mt-2 text-right text-[12px] font-medium text-gray-500">
            {len} / {MSG_MAX}
          </p>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-black/[0.04] bg-[#F5F3EE]/95 px-5 py-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
    </>
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

function AppleMark() {
  return (
    <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2 .91-3.67.91-1.48 0-2.37-1.29-3.42-2.67-1.75-2.37-1.86-4.79-1.86-5.85 0-2.87 1.85-5.44 2.92-6.42 1.1-1.03 2.58-1.59 3.74-1.59 1.48 0 2.06.57 3.71.57 1.7 0 2.22-.57 3.73-.57 1.06 0 2.49.42 3.67 1.65-3.24 1.76-2.72 6.34.48 8.42z" />
    </svg>
  );
}

function StepCreateAccount({
  peer,
  onComplete,
}: {
  peer: FunnelMatchPick | null;
  onComplete: (via: "google" | "apple" | "email") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailOk = email.includes("@") && email.length > 4;
  const passOk = password.length >= 6;

  return (
    <div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
      <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">Almost there ✨</h2>
      <p className="mt-1 text-[14px] text-gray-600">
        Save your profile and your first chat with {peer?.name ?? "them"}.
      </p>

      {peer && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100">
            <Image src={peer.photo} alt="" width={112} height={112} className="h-full w-full object-cover" />
          </span>
          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-gray-800">
            Your message is ready to send to {peer.name}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onComplete("google")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-bold text-gray-900 shadow-sm ring-1 ring-black/[0.08] transition active:scale-95"
        >
          <GoogleMark />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => onComplete("apple")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-3.5 text-[15px] font-bold text-white shadow-sm transition active:scale-95"
        >
          <AppleMark />
          Continue with Apple
        </button>

        <div className="relative my-2 py-2 text-center">
          <span className="relative z-10 bg-[#F5F3EE] px-3 text-[12px] font-semibold text-gray-500">or</span>
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gray-200" aria-hidden />
        </div>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#7C5CFF]/30"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#7C5CFF]/30"
            autoComplete="new-password"
          />
        </label>
        <button
          type="button"
          disabled={!emailOk || !passOk}
          onClick={() => onComplete("email")}
          className={`mt-1 flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-bold transition active:scale-95 ${
            emailOk && passOk
              ? "bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] text-white shadow-pill"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          Create account →
        </button>
      </div>

      <p className="mt-6 text-center text-[10px] leading-relaxed text-gray-500">
        By continuing you agree to our{" "}
        <Link href="/me/help" className="text-[#7C5CFF] underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/me/privacy" className="text-[#7C5CFF] underline-offset-2 hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
