"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  DEFAULT_DISCOVERY_PREFS,
  FUNNEL_INTEREST_OPTIONS,
  type ChatEnergy,
  type ConnectWith,
  type DatingIntent,
  type DiscoveryPreferencesV1,
  saveDiscoveryPreferences,
} from "@/lib/discovery-preferences";

const MAX_INTEREST_PICKS = 5;

const STEP_ICONS = [
  Heart,
  Users,
  Heart,
  Sparkles,
  Search,
  Heart,
  Search,
  Sparkles,
  Lock,
  Heart,
] as const;

const STEP_TITLES = [
  "Welkom bij whisper",
  "Wie wil je leren kennen?",
  "Welke leeftijd past bij jou?",
  "Welke sfeer zoek je in gesprekken?",
  "Waar heb je interesse in?",
  "Wat zoek je nu?",
  "Zo werkt whisper",
  "Sprankels",
  "Veilig & respectvol",
  "Klaar om te ontdekken",
];

type OnboardingFunnelProps = {
  onComplete: () => void;
};

export function OnboardingFunnel({ onComplete }: OnboardingFunnelProps) {
  const [index, setIndex] = useState(0);
  const [prefs, setPrefs] = useState<DiscoveryPreferencesV1>(() => ({
    ...DEFAULT_DISCOVERY_PREFS,
  }));

  const total = STEP_TITLES.length;
  const isLast = index === total - 1;

  const canAdvance = useMemo(() => {
    if (index === 4) return prefs.interestPicks.length >= 1;
    return true;
  }, [index, prefs.interestPicks.length]);

  const next = useCallback(() => {
    if (!canAdvance) return;
    if (isLast) {
      saveDiscoveryPreferences(prefs);
      onComplete();
      return;
    }
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [canAdvance, isLast, onComplete, prefs, total]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const Icon = STEP_ICONS[index] ?? Heart;

  const body: ReactNode = (() => {
    switch (index) {
      case 0:
        return (
          <p className="text-[15px] leading-relaxed text-inkMuted">
            We stellen een paar korte vragen om je{" "}
            <strong className="text-ink">feed te personaliseren</strong>. Daarna
            zie je profielen die beter bij je voorkeuren passen — rustig daten,
            echte gesprekken.
          </p>
        );
      case 1:
        return (
          <div className="space-y-2">
            <p className="text-[13px] leading-snug text-inkMuted">
              Je kiest wat je wilt zien; iedereen verdient respect.
            </p>
            <div className="grid gap-2">
              {(
                [
                  { id: "everyone" as const, label: "Iedereen" },
                  { id: "women" as const, label: "Vrouwen" },
                  { id: "men" as const, label: "Mannen" },
                ] satisfies { id: ConnectWith; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({ ...p, connectWith: opt.id }))
                  }
                  className={`rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition ${
                    prefs.connectWith === opt.id
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "border-ink/10 bg-white text-ink active:scale-[0.99]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-2">
            <p className="text-[13px] text-inkMuted">
              We wegen profielen rond deze leeftijd wat zwaarder in je feed.
            </p>
            <div className="grid gap-2">
              {(
                [
                  { label: "18–27 jaar", min: 18, max: 27 },
                  { label: "28–37 jaar", min: 28, max: 37 },
                  { label: "38–50 jaar", min: 38, max: 50 },
                  { label: "51+ jaar", min: 51, max: 75 },
                  { label: "Maakt niet uit", min: 18, max: 80 },
                ] as const
              ).map((band) => {
                const active =
                  prefs.ageMin === band.min && prefs.ageMax === band.max;
                return (
                  <button
                    key={band.label}
                    type="button"
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        ageMin: band.min,
                        ageMax: band.max,
                      }))
                    }
                    className={`rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold transition ${
                      active
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "border-ink/10 bg-white text-ink active:scale-[0.99]"
                    }`}
                  >
                    {band.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-2">
            <p className="text-[13px] text-inkMuted">
              Geen goed of fout — we gebruiken dit om volgorde en tips te tunen.
            </p>
            <div className="grid gap-2">
              {(
                [
                  { id: "calm" as const, label: "Rustig & diep" },
                  { id: "playful" as const, label: "Luchtig & speels" },
                  { id: "both" as const, label: "Allebei" },
                ] satisfies { id: ChatEnergy; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({ ...p, chatEnergy: opt.id }))
                  }
                  className={`rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition ${
                    prefs.chatEnergy === opt.id
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "border-ink/10 bg-white text-ink active:scale-[0.99]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <p className="text-[13px] text-inkMuted">
              Kies minimaal één, maximaal {MAX_INTEREST_PICKS}. Profielen met
              overlap komen hoger in je feed.
            </p>
            <div className="flex flex-wrap gap-2">
              {FUNNEL_INTEREST_OPTIONS.map((label) => {
                const on = prefs.interestPicks.includes(label);
                const maxed =
                  !on && prefs.interestPicks.length >= MAX_INTEREST_PICKS;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={maxed}
                    onClick={() =>
                      setPrefs((p) => {
                        const has = p.interestPicks.includes(label);
                        if (has) {
                          return {
                            ...p,
                            interestPicks: p.interestPicks.filter(
                              (x) => x !== label,
                            ),
                          };
                        }
                        if (p.interestPicks.length >= MAX_INTEREST_PICKS)
                          return p;
                        return {
                          ...p,
                          interestPicks: [...p.interestPicks, label],
                        };
                      })
                    }
                    className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                      on
                        ? "bg-primary text-white shadow-sm"
                        : maxed
                          ? "cursor-not-allowed bg-ink/[0.04] text-ink/30"
                          : "bg-ink/[0.06] text-ink ring-1 ring-black/[0.06]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-2">
            <p className="text-[13px] text-inkMuted">
              We matchen dit grofweg met &quot;waar iemand naar op zoek is&quot; in
              profielen.
            </p>
            <div className="grid gap-2">
              {(
                [
                  { id: "serious" as const, label: "Iets serieus / diepgang" },
                  { id: "casual" as const, label: "Casual & ontspannen" },
                  { id: "friends" as const, label: "Vooral vriendschap" },
                  { id: "open" as const, label: "Nog aan het uitvinden" },
                ] satisfies { id: DatingIntent; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({ ...p, datingIntent: opt.id }))
                  }
                  className={`rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition ${
                    prefs.datingIntent === opt.id
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "border-ink/10 bg-white text-ink active:scale-[0.99]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <ul className="space-y-3 text-left text-[14px] leading-snug text-inkMuted">
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
                <Search className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span>
                <strong className="text-ink">Ontdekken</strong> — scroll door
                profielen en tik om iemand te openen.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
                <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span>
                <strong className="text-ink">Berichten</strong> — chat met
                sprankels; persona&apos;s reageren natuurlijk.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
                <Link2 className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span>
                <strong className="text-ink">Koppelingen</strong> — als het wederzijds
                is, koppel je.
              </span>
            </li>
          </ul>
        );
      case 7:
        return (
          <p className="text-[15px] leading-relaxed text-inkMuted">
            Sprankels zijn je in-app balans voor berichten en extra&apos;s. Je saldo
            staat rechtsboven; pakketten volgen later in de app.
          </p>
        );
      case 8:
        return (
          <p className="text-[15px] leading-relaxed text-inkMuted">
            Whisper is 18+. Wees vriendelijk, accepteer grenzen en meld gedrag dat
            niet klopt. Berichten lopen versleuteld; jij kiest met wie je praat.
          </p>
        );
      case 9:
        return (
          <div className="space-y-3 text-left text-[14px] leading-relaxed text-inkMuted">
            <p>
              Je voorkeuren worden{" "}
              <strong className="text-ink">op dit apparaat</strong> bewaard om je
              feed te sorteren. Later kunnen we ze aan je account koppelen.
            </p>
            <ul className="list-inside list-disc space-y-1 text-[13px]">
              <li>
                Leeftijd: {prefs.ageMin}–{prefs.ageMax} jaar
              </li>
              <li>
                Voorkeur:{" "}
                {prefs.connectWith === "everyone"
                  ? "iedereen"
                  : prefs.connectWith === "women"
                    ? "vrouwen"
                    : "mannen"}
              </li>
              <li>Interesses: {prefs.interestPicks.join(", ") || "—"}</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-canvas via-[#FAF8F4] to-lavender/30 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <header className="shrink-0 pb-4 pt-2 text-center">
        <p className="font-display text-[2.5rem] font-semibold lowercase leading-none tracking-tight text-ink">
          whisper
        </p>
        <p className="mt-2 text-[13px] font-medium text-inkMuted">
          Rustig daten · echte gesprekken
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="mx-auto max-w-sm rounded-3xl bg-white/90 p-5 shadow-card ring-1 ring-black/[0.06] backdrop-blur-sm sm:p-6"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primarySoft text-white shadow-md sm:mb-4 sm:h-14 sm:w-14">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
            </div>
            <h1 className="text-center text-lg font-bold leading-tight text-ink sm:text-xl">
              {STEP_TITLES[index]}
            </h1>
            <div className="mt-3 sm:mt-4">{body}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="shrink-0 space-y-3 pt-4 sm:space-y-4 sm:pt-6">
        <div className="flex max-w-sm flex-wrap justify-center gap-1.5 px-2">
          {STEP_TITLES.map((_, i) => (
            <span
              key={String(i)}
              className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${
                i === index ? "bg-primary" : "bg-ink/15"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="min-h-[50px] flex-1 rounded-full border border-ink/10 bg-white py-3.5 text-[15px] font-semibold text-ink shadow-sm transition active:scale-[0.99] sm:min-h-[52px]"
            >
              Terug
            </button>
          ) : (
            <span className="min-h-[50px] flex-1 sm:min-h-[52px]" aria-hidden />
          )}
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            className="inline-flex min-h-[50px] flex-[1.35] items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 pl-4 pr-3 text-[15px] font-bold text-white shadow-fab transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[52px] sm:pl-5 sm:pr-4"
          >
            {isLast ? "Naar mijn feed" : "Verder"}
            <ChevronRight className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2.25} />
          </button>
        </div>

        <p className="text-center text-[11px] text-inkMuted">
          Stap {index + 1} van {total}
          {!canAdvance && index === 4 ? " — kies minstens één interesse" : ""}
        </p>
      </div>
    </div>
  );
}
