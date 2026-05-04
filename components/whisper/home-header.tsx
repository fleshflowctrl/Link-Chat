import { SlidersHorizontal } from "lucide-react";

export function HomeHeader() {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-4">
      <h1 className="font-display text-[2.35rem] font-semibold leading-none tracking-tight text-ink lowercase">
        whisper
      </h1>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-pill">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accentGreen/50 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accentGreen" />
          </span>
          12 online now
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-pill transition active:scale-95"
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
