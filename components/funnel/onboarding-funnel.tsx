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
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FUNNEL_SESSION_KEY, ONBOARDED_KEY } from "@/data/funnel";
import { funnelSets, type FunnelWelcomeCard } from "@/data/funnelProfiles";
import {
  profiles as staticCatalogProfiles,
  type Profile,
} from "@/data/profiles";
import { trackFunnelStep } from "@/lib/analytics/visitor-id";
import { FUNNEL_STEP_WELCOME_CTA, FUNNEL_STEP_WELCOME_VIEW } from "@/lib/analytics/funnel-steps";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT } from "@/lib/app-variant";
import {
  FunnelConfigProvider,
  useFunnelConfig,
} from "@/components/funnel/funnel-config-context";
import { isPermanentAuthUser } from "@/lib/auth/guest-session";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { SITE_DISPLAY } from "@/lib/brand";
import { APP_SHELL_WIDTH_CLASS } from "@/lib/responsive-shell";

const WELCOME_MIN_PROFILE_AGE = 40;

function OnboardingFunnelFallback() {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-canvas">
      <span className="text-sm text-gray-500">Laden…</span>
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

  const funnelCatalog = useMemo(
    () =>
      initialCatalog && initialCatalog.length > 0
        ? initialCatalog
        : staticCatalogProfiles,
    [initialCatalog],
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
        if (!cancelled) setHydrated(true);
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
          /* continue to welcome */
        }
      }

      if (localStorage.getItem(ONBOARDED_KEY) === "true") {
        router.replace(cfg.discoverPath);
        return;
      }

      try {
        sessionStorage.removeItem(FUNNEL_SESSION_KEY);
      } catch {
        /* ignore */
      }

      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, cfg.discoverPath, testFunnel]);

  useEffect(() => {
    if (!hydrated) return;
    void trackFunnelStep(FUNNEL_STEP_WELCOME_VIEW, cfg.variant);
  }, [hydrated, cfg.variant]);

  const enterDiscover = useCallback(() => {
    void trackFunnelStep(FUNNEL_STEP_WELCOME_CTA, cfg.variant);
    try {
      localStorage.setItem(ONBOARDED_KEY, "true");
      sessionStorage.removeItem(FUNNEL_SESSION_KEY);
    } catch {
      /* ignore */
    }
    router.replace(cfg.discoverPath);
  }, [router, cfg.discoverPath]);

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
      className={`fixed inset-0 z-10 flex justify-center overflow-hidden overscroll-none touch-manipulation md:px-4 lg:px-6 ${cfg.outerBg}`}
      style={accentStyle}
    >
      <div
        className={`relative flex h-full min-h-0 flex-col overflow-hidden overscroll-none touch-manipulation ${APP_SHELL_WIDTH_CLASS} ${cfg.cardBg} shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(60,40,20,0.12)]`}
      >
        <StepWelcome onStart={enterDiscover} catalog={funnelCatalog} />
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

const WELCOME_STATUS_PATTERN: ReadonlyArray<FunnelWelcomeCard["status"]> = [
  null,
  "new",
  "new",
  null,
];

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
    subMuted: "Voor 50-plussers. ",
    subAccent: "Discreet · op jouw tempo.",
  },
  v2: {
    headline: ["Nieuwe spanning.", "Gewoon privé."],
    subMuted: "Voor 50-plussers. ",
    subAccent: "Geen haast · wel spanning.",
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
  const [setIndex, setSetIndex] = useState(0);
  const lastInteractRef = useRef(0);

  const welcomeSets = useMemo(
    () => buildWelcomeSetsFromCatalog(catalog),
    [catalog],
  );

  const touchCards = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);

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

      <div className="pointer-events-auto z-20 shrink-0 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))]">
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

        <button
          type="button"
          onClick={onStart}
          className="mt-3 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[var(--funnel-accent)] to-[var(--funnel-accent-soft)] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-95"
        >
          Start discreet rondkijken
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
