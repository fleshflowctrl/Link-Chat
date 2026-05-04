"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Cake,
  Check,
  Clock,
  Coins,
  CreditCard,
  Lock,
  MessageCircle,
  Star,
  Vault,
  Wallet,
  Zap,
} from "lucide-react";
import {
  creditBalance,
  creditPackages,
  offerCountdownInitialSeconds,
  type CreditPackage,
  type CreditPackageVariant,
} from "@/data/credits";

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

const tileClass: Record<CreditPackageVariant, string> = {
  purple: "bg-gradient-primary text-white shadow-inner",
  pink: "bg-accentPink text-white shadow-inner",
  orange: "bg-accentOrange text-white shadow-inner",
  yellow: "bg-amber-400 text-amber-950 shadow-inner",
};

function PackageTileIcon({ pkg }: { pkg: CreditPackage }) {
  const iconClass = "h-7 w-7 shrink-0 drop-shadow-sm";
  switch (pkg.variant) {
    case "purple":
      return (
        <span className="flex items-center justify-center gap-0.5">
          <Star className={iconClass} fill="currentColor" strokeWidth={1.5} />
          <Coins className="h-6 w-6 shrink-0 opacity-95" strokeWidth={2} />
        </span>
      );
    case "pink":
      return <Cake className={iconClass} strokeWidth={2} />;
    case "orange":
      return <Wallet className={iconClass} strokeWidth={2} />;
    case "yellow":
      return <Vault className={iconClass} strokeWidth={2} />;
  }
}

export function CreditsView() {
  const defaultId =
    creditPackages.find((p) => p.defaultSelected)?.id ?? creditPackages[0].id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [secondsLeft, setSecondsLeft] = useState(offerCountdownInitialSeconds);

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) return offerCountdownInitialSeconds;
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  const countdownLabel = useMemo(
    () => formatCountdown(secondsLeft),
    [secondsLeft],
  );

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-ink">
          Buy credits
        </h1>
        <div className="flex shrink-0 flex-col items-center rounded-2xl bg-white px-3.5 py-2.5 text-center shadow-card ring-1 ring-black/[0.05]">
          <span className="text-xl leading-none" aria-hidden>
            😊
          </span>
          <span className="mt-1 text-lg font-bold leading-none text-ink">
            {creditBalance}
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-inkMuted">
            Your balance
          </span>
        </div>
      </header>

      <div className="px-5 pb-5">
        <p className="text-[15px] leading-snug text-inkMuted">
          Credits let you start and continue conversations.
        </p>
        <p className="mt-1 bg-gradient-to-r from-primary to-primarySoft bg-clip-text text-[15px] font-semibold text-transparent">
          More chats, more connections.
        </p>
      </div>

      <div className="px-5 pb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-lavender px-3.5 py-3.5 shadow-card ring-1 ring-primary/[0.08]">
          <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center text-3xl">
            <span className="absolute text-4xl drop-shadow-md" aria-hidden>
              🎁
            </span>
            <span
              className="absolute -bottom-0.5 -right-0.5 text-lg drop-shadow"
              aria-hidden
            >
              🪙
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-ink">
              Limited time offer!
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-inkMuted">
              Get 20% extra credits on your first purchase.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-white shadow-pill">
            <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span className="font-mono text-[13px] font-bold tabular-nums tracking-tight">
              {countdownLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pb-6">
        {creditPackages.map((pkg) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            selected={selectedId === pkg.id}
            onSelect={() => setSelectedId(pkg.id)}
          />
        ))}
      </div>

      <div className="px-5 pb-8">
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-lavender/80 px-3 py-5 shadow-sm ring-1 ring-black/[0.04]">
          <FeatureCell
            icon={<MessageCircle className="h-5 w-5 text-primary" strokeWidth={2} />}
            title="Start conversations"
            subtitle="Send the first message"
          />
          <FeatureCell
            icon={<Lock className="h-5 w-5 text-primary" strokeWidth={2} />}
            title="Unlock replies"
            subtitle="Read and reply freely"
          />
          <FeatureCell
            icon={<Zap className="h-5 w-5 text-primary" strokeWidth={2} />}
            title="Priority & visibility"
            subtitle="Get noticed more"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <button
          type="button"
          onClick={() => console.log("[credits] Apple Pay placeholder")}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg transition active:scale-[0.99]"
        >
          <svg
            className="h-6 w-6 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          <span>Pay</span>
        </button>
        <button
          type="button"
          onClick={() => console.log("[credits] Card payment placeholder")}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-ink/10 bg-white px-5 py-3.5 text-[15px] font-semibold text-ink shadow-card transition active:scale-[0.99]"
        >
          <CreditCard className="h-5 w-5 text-ink/80" strokeWidth={2} />
          <span>Pay with card</span>
        </button>
      </div>

      <footer className="px-5 pb-6 text-center">
        <p className="flex flex-wrap items-center justify-center gap-1 text-[12px] text-inkMuted">
          <Lock className="inline h-3.5 w-3.5 shrink-0 text-inkMuted" strokeWidth={2} />
          <span>Secure payment. Cancel anytime.</span>
        </p>
        <p className="mt-2 text-[12px] font-medium">
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => console.log("[credits] Terms placeholder")}
          >
            Terms
          </button>
          <span className="text-ink/30"> · </span>
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => console.log("[credits] Privacy placeholder")}
          >
            Privacy
          </button>
        </p>
      </footer>
    </>
  );
}

function FeatureCell({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-primary/10">
        {icon}
      </span>
      <p className="mt-2 text-[12px] font-bold leading-tight text-ink">{title}</p>
      <p className="mt-0.5 px-0.5 text-[10px] font-medium leading-snug text-inkMuted">
        {subtitle}
      </p>
    </div>
  );
}

function PackageRow({
  pkg,
  selected,
  onSelect,
}: {
  pkg: CreditPackage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      {pkg.mostPopular && (
        <div className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-full bg-gradient-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            Most popular
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full min-h-[88px] items-center gap-3 rounded-2xl bg-white px-3.5 py-4 text-left shadow-card ring-1 transition ${
          selected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-canvas"
            : "ring-black/[0.06] hover:ring-black/10"
        } ${pkg.mostPopular ? "pt-5" : ""}`}
      >
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tileClass[pkg.variant]}`}
        >
          <PackageTileIcon pkg={pkg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold text-ink">
              {pkg.credits} credits
            </span>
            <span className="rounded-full bg-accentPink/15 px-2 py-0.5 text-[11px] font-bold text-accentPink ring-1 ring-accentPink/25">
              +{pkg.bonusCredits} bonus
            </span>
          </div>
          <p className="mt-1 text-[13px] text-inkMuted">{pkg.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 pr-0.5">
          <div className="text-right">
            <p className="text-[15px] font-bold text-ink">{pkg.price}</p>
            <p className="text-[12px] font-medium text-inkMuted line-through">
              {pkg.originalPrice}
            </p>
          </div>
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
              selected
                ? "border-primary bg-primary"
                : "border-ink/20 bg-transparent"
            }`}
            aria-hidden
          >
            {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </span>
        </div>
      </button>
    </div>
  );
}
