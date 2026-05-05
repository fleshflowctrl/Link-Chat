"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  type WhisperUserLocal,
  WHISPER_USER_KEY,
} from "@/data/funnel";
import {
  appendOnboardingOutboundToMockThread,
  getThreadMeta,
} from "@/data/messages";
import { likesPreviewAvatarUrls } from "@/data/profiles";
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
  lookingForId: string | null;
  vibes: string[];
  ageMin: number;
  ageMax: number;
  name: string;
  age: string;
  location: string;
  pickedMatchId: string | null;
  firstMessage: string;
};

const defaultPersist = (): FunnelPersist => ({
  step: 1,
  lookingForId: null,
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
    const p = JSON.parse(raw) as Partial<FunnelPersist>;
    return { ...defaultPersist(), ...p, step: Math.min(STEP_TOTAL, Math.max(1, Number(p.step) || 1)) };
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

  const [lookingForId, setLookingForId] = useState<string | null>(null);
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
      setLookingForId(saved.lookingForId);
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
      lookingForId,
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
    lookingForId,
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
        lookingForId: lookingForId ?? FUNNEL_LOOKING_FOR[0].id,
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
      lookingForId,
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
        <header className="sticky top-0 z-20 flex h-10 shrink-0 items-center gap-2 border-b border-black/[0.04] bg-[#F5F3EE]/95 px-3 pt-[max(4px,env(safe-area-inset-top))] backdrop-blur-sm">
          <div className="flex w-9 shrink-0 justify-start">
            {step > 1 && step < 8 && (
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1 px-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: "tween", duration: 0.25 }}
              />
            </div>
          </div>
          <div className="w-14 shrink-0 text-right text-[10px] font-medium text-gray-500">
            Step {step} / {STEP_TOTAL}
          </div>
        </header>

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
              {step === 1 && (
                <StepWelcome onStart={goNext} />
              )}
              {step === 2 && (
                <StepLookingFor
                  selected={lookingForId}
                  onSelect={(id) => {
                    setLookingForId(id);
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

function StepWelcome({ onStart }: { onStart: () => void }) {
  const [count, setCount] = useState(12_380);
  useEffect(() => {
    const target = 12_453;
    const start = performance.now();
    const dur = 1600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - (1 - p) ** 2;
      setCount(Math.round(12_380 + (target - 12_380) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
      <FloatingBlobs />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-[40px] font-semibold lowercase leading-none tracking-tight text-ink">
          whisper
        </h1>
        <p className="mt-4 text-[22px] font-extrabold leading-snug text-gray-900">
          <span className="block">Real conversations.</span>
          <span className="text-[#7C5CFF]">Your pace.</span>
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center pl-2">
            {likesPreviewAvatarUrls.map((url, i) => (
              <span
                key={url}
                className="-ml-2 relative h-10 w-10 overflow-hidden rounded-full border-2 border-[#F5F3EE] bg-gray-200 ring-1 ring-black/[0.06]"
                style={{ zIndex: 3 - i }}
              >
                <Image src={url} alt="" width={80} height={80} className="h-full w-full object-cover" />
              </span>
            ))}
          </div>
          <p className="text-[13px] font-medium text-gray-600">
            <span className="tabular-nums font-semibold text-gray-900">{count.toLocaleString()}</span>{" "}
            people connecting right now
          </p>
        </div>
      </div>
      <div className="relative z-10 mt-auto flex w-full flex-col items-center gap-3 pt-8">
        <button
          type="button"
          onClick={onStart}
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-4 text-[16px] font-bold text-white shadow-pill transition active:scale-95"
        >
          Get started
          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <p className="text-center text-[12px] text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#7C5CFF] underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function FloatingBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-[#7C5CFF]/10 blur-3xl"
        animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-20 bottom-40 h-56 w-56 rounded-full bg-pink-300/15 blur-3xl"
        animate={{ y: [0, 14, 0], x: [0, -10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/3 top-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#9B7BFF]/12 blur-2xl"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function StepLookingFor({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
      <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">
        What brings you here?
      </h2>
      <p className="mt-1 text-[14px] text-gray-600">We&apos;ll personalize your feed.</p>
      <ul className="mt-8 flex flex-col gap-3">
        {FUNNEL_LOOKING_FOR.map((opt) => {
          const isSel = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-2 transition active:scale-[0.98] ${
                  isSel ? "ring-[#7C5CFF]" : "ring-transparent"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {opt.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[16px] font-bold text-gray-900">{opt.label}</span>
                    {isSel && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-gray-500">{opt.description}</span>
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
  setVibes: (v: string[]) => void;
  onContinue: () => void;
}) {
  const toggle = (id: string) => {
    setVibes(
      vibes.includes(id) ? vibes.filter((x) => x !== id) : [...vibes, id],
    );
  };
  const n = vibes.length;
  const ok = n >= 3;

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-28 pt-5">
        <h2 className="text-[28px] font-extrabold leading-tight text-gray-900">What&apos;s your vibe?</h2>
        <p className="mt-1 text-[14px] text-gray-600">Pick 3 or more.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {FUNNEL_VIBES.map((v) => {
            const on = vibes.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition active:scale-95 ${
                  on
                    ? `${v.selectedClass} text-gray-900`
                    : `${v.tint} text-gray-700 ring-1 ring-black/[0.06]`
                }`}
              >
                {v.emoji} {v.label}
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
          Continue ({n}/3)
        </button>
      </div>
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
