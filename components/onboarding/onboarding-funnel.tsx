"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

type Step = {
  key: string;
  title: string;
  body: ReactNode;
  icon: typeof Heart;
};

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "Welkom bij whisper",
    icon: Heart,
    body: (
      <p className="text-[15px] leading-relaxed text-inkMuted">
        Ontdek mensen in jouw buurt, chat op een rustige manier en koppel wanneer
        het wederzijds voelt — zonder druk.
      </p>
    ),
  },
  {
    key: "how",
    title: "Zo werkt het",
    icon: Search,
    body: (
      <ul className="space-y-3 text-left text-[14px] leading-snug text-inkMuted">
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
            <Search className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span>
            <strong className="text-ink">Ontdekken</strong> — swipe door profielen
            en open iemand die je aanspreekt.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
            <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span>
            <strong className="text-ink">Berichten</strong> — gebruik sprankels om
            te chatten; AI-persona&apos;s reageren net als echte gesprekken.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary ring-1 ring-primary/15">
            <Link2 className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span>
            <strong className="text-ink">Koppelingen</strong> — als het klikt,
            koppel je en zie je elkaar beter terug.
          </span>
        </li>
      </ul>
    ),
  },
  {
    key: "sprankels",
    title: "Sprankels",
    icon: Sparkles,
    body: (
      <p className="text-[15px] leading-relaxed text-inkMuted">
        Sprankels zijn je in-app balans om berichten te sturen en functies te
        gebruiken. Je ziet je saldo rechtsboven — later kun je pakketten kopen
        als je wilt.
      </p>
    ),
  },
  {
    key: "safe",
    title: "Veilig & respectvol",
    icon: Lock,
    body: (
      <p className="text-[15px] leading-relaxed text-inkMuted">
        Whisper is voor volwassenen (18+). Wees vriendelijk, accepteer een &quot;nee&quot;
        en meld gedrag dat niet klopt. Chats zijn versleuteld tussen jou en de
        app — jij bepaalt met wie je praat.
      </p>
    ),
  },
];

type OnboardingFunnelProps = {
  onComplete: () => void;
};

export function OnboardingFunnel({ onComplete }: OnboardingFunnelProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [isLast, onComplete]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const Icon = step.icon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-canvas via-[#FAF8F4] to-lavender/30 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <header className="shrink-0 pb-6 pt-2 text-center">
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
            key={step.key}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="mx-auto max-w-sm rounded-3xl bg-white/90 p-6 shadow-card ring-1 ring-black/[0.06] backdrop-blur-sm"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primarySoft text-white shadow-md">
              <Icon className="h-7 w-7" strokeWidth={2} />
            </div>
            <h1 className="text-center text-xl font-bold leading-tight text-ink">
              {step.title}
            </h1>
            <div className="mt-4">{step.body}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="shrink-0 space-y-4 pt-6">
        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`h-2 w-2 rounded-full transition-colors ${
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
              className="min-h-[52px] flex-1 rounded-full border border-ink/10 bg-white py-3.5 text-[15px] font-semibold text-ink shadow-sm transition active:scale-[0.99]"
            >
              Terug
            </button>
          ) : (
            <span className="min-h-[52px] flex-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={next}
            className="inline-flex min-h-[52px] flex-[1.35] items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 pl-5 pr-4 text-[15px] font-bold text-white shadow-fab transition active:scale-[0.99]"
          >
            {isLast ? "Begin met ontdekken" : "Verder"}
            <ChevronRight className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2.25} />
          </button>
        </div>

        <p className="text-center text-[11px] text-inkMuted">
          Stap {index + 1} van {STEPS.length}
        </p>
      </div>
    </div>
  );
}
