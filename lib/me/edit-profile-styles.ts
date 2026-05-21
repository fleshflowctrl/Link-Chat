import type { AppVariant } from "@/lib/app-variant";

export type EditProfileUi = {
  card: string;
  cardFlat: string;
  divider: string;
  backBtn: string;
  avatarRing: string;
  avatarInner: string;
  avatarPlaceholder: string;
  cameraBtn: string;
  bio: string;
  lookingBtn: string;
  lookingIcon: string;
  lookingLabel: string;
  lookingValue: string;
  lookingValueEmpty: string;
  lookingValueProfile: string;
  sayHelloBtn: string;
  sayHelloBar: string;
  galleryTile: string;
  galleryAdd: string;
  interestChip: string;
  interestRemove: string;
  addInterestBtn: string;
  sheet: string;
  sheetOption: (active: boolean) => string;
  interestPicker: (active: boolean, maxed: boolean) => string;
};

export function getEditProfileUi(variant: AppVariant): EditProfileUi {
  const isV2 = variant === "v2";

  return {
    card: isV2
      ? "overflow-hidden rounded-2xl bg-[#2A2A2B] shadow-card ring-1 ring-white/10"
      : "overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.06]",
    cardFlat: isV2
      ? "flex w-full items-center justify-between rounded-2xl bg-[#2A2A2B] px-4 py-2.5 shadow-card ring-1 ring-white/10"
      : "flex w-full items-center justify-between rounded-2xl bg-white px-4 py-2.5 shadow-card ring-1 ring-black/[0.06]",
    divider: isV2 ? "mx-4 h-px bg-white/10" : "mx-4 h-px bg-black/[0.06]",
    backBtn: isV2
      ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#353536] text-ink shadow-md ring-1 ring-white/10 transition active:scale-95 disabled:opacity-60"
      : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/80 text-white shadow-md transition active:scale-95 disabled:opacity-60",
    avatarRing: isV2
      ? "rounded-full bg-gradient-to-br from-[#B52B2A] via-[#C93535] to-[#D63B3A] p-[3px] shadow-card"
      : "rounded-full bg-gradient-to-br from-primary via-primarySoft to-accentPink p-[3px] shadow-card",
    avatarInner: isV2
      ? "relative h-32 w-32 overflow-hidden rounded-full bg-canvas ring-2 ring-[#353536]"
      : "relative h-32 w-32 overflow-hidden rounded-full bg-canvas ring-2 ring-white",
    avatarPlaceholder: isV2
      ? "flex h-full w-full items-center justify-center bg-[#353536] text-ink/35"
      : "flex h-full w-full items-center justify-center bg-gradient-to-br from-lavender/40 to-canvas text-ink/25",
    cameraBtn: isV2
      ? "absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#353536] text-ink shadow-lg ring-2 ring-[#2A2A2B] transition active:scale-95"
      : "absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-2 ring-canvas transition active:scale-95",
    bio: isV2
      ? "w-full resize-none rounded-xl bg-[#2A2A2B] px-3 py-2.5 pb-7 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-white/10"
      : "w-full resize-none rounded-xl bg-ink/[0.04] px-3 py-2.5 pb-7 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-black/[0.06]",
    lookingBtn: isV2
      ? "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#2A2A2B] px-4 py-3 text-left shadow-card transition active:scale-[0.99]"
      : "flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-100 via-rose-100 to-pink-200 px-4 py-3 text-left shadow-card ring-1 ring-accentPink/20 transition active:scale-[0.99]",
    lookingIcon: isV2
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#B52B2A] to-[#D63B3A] text-white shadow-md"
      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accentPink to-primary text-white shadow-md",
    lookingLabel: isV2
      ? "text-[10px] font-bold uppercase tracking-wider text-[#D63B3A]"
      : "text-[10px] font-bold uppercase tracking-wider text-accentPink",
    lookingValue: isV2
      ? "truncate text-[14px] font-bold text-[#E8E8E8]"
      : "truncate text-[14px] font-bold text-ink",
    lookingValueEmpty: "truncate text-[14px] font-bold text-inkMuted",
    lookingValueProfile: isV2
      ? "text-[15px] font-bold leading-snug text-[#E8E8E8]"
      : "text-[15px] font-bold leading-snug text-ink",
    sayHelloBtn:
      "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 py-3.5 text-[15px] font-bold text-white shadow-lg transition active:scale-[0.99]",
    sayHelloBar: isV2
      ? "sticky bottom-0 z-20 border-t border-white/10 bg-canvas/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-canvas/90"
      : "sticky bottom-0 z-20 border-t border-black/[0.06] bg-canvas/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-canvas/90",
    galleryTile: isV2
      ? "relative aspect-square overflow-hidden rounded-2xl bg-[#353536] ring-1 ring-white/10 shadow-sm"
      : "relative aspect-square overflow-hidden rounded-2xl bg-ink/10 ring-1 ring-black/[0.06] shadow-sm",
    galleryAdd: isV2
      ? "flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-[#B52B2A]/50 bg-[#B52B2A]/10 text-primary transition active:bg-[#B52B2A]/20"
      : "flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-primary/45 bg-primary/[0.04] text-primary transition active:bg-primary/10",
    interestChip: isV2
      ? "inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[13px] font-bold text-ink ring-1 ring-white/10"
      : "inline-flex items-center gap-1 rounded-full bg-ink/[0.08] px-2.5 py-1.5 text-[13px] font-bold text-ink ring-1 ring-black/[0.05]",
    interestRemove: isV2
      ? "ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-ink/80 transition hover:bg-white/25"
      : "ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-ink/70 transition hover:bg-black/15",
    addInterestBtn: isV2
      ? "inline-flex items-center rounded-full border-2 border-dashed border-[#B52B2A]/50 px-2.5 py-1.5 text-[13px] font-bold text-primary"
      : "inline-flex items-center rounded-full border-2 border-dashed border-primary/45 px-2.5 py-1.5 text-[13px] font-bold text-primary",
    sheet: isV2
      ? "max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-[#252526] px-5 pb-10 pt-5 shadow-2xl ring-1 ring-white/10"
      : "max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-canvas px-5 pb-10 pt-5 shadow-2xl",
    sheetOption: (active) =>
      isV2
        ? active
          ? "rounded-xl bg-[#B52B2A]/20 px-4 py-3 text-left text-[15px] font-semibold text-ink ring-1 ring-[#B52B2A]/40"
          : "rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-ink transition hover:bg-white/5"
        : active
          ? "rounded-xl bg-primary/12 px-4 py-3 text-left text-[15px] font-semibold text-primary ring-1 ring-primary/25"
          : "rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-ink transition hover:bg-black/[0.03]",
    interestPicker: (active, maxed) => {
      if (active) return "rounded-full bg-primary px-3 py-2 text-[13px] font-semibold text-white shadow-sm";
      if (maxed) {
        return isV2
          ? "cursor-not-allowed rounded-full bg-white/5 px-3 py-2 text-[13px] font-semibold text-ink/30"
          : "cursor-not-allowed rounded-full bg-ink/[0.04] px-3 py-2 text-[13px] font-semibold text-ink/30";
      }
      return isV2
        ? "rounded-full bg-white/10 px-3 py-2 text-[13px] font-semibold text-ink ring-1 ring-white/10 transition"
        : "rounded-full bg-ink/[0.06] px-3 py-2 text-[13px] font-semibold text-ink ring-1 ring-black/[0.06] transition";
    },
  };
}
