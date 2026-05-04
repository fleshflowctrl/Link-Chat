import Image from "next/image";
import { AudioWaveform, Flame } from "lucide-react";
import { profiles } from "@/data/profiles";

export function ActivityStrip() {
  const maya = profiles.find((p) => p.id === "maya")!;
  const clara = profiles.find((p) => p.id === "clara")!;

  const cells = [
    {
      key: "typing",
      icon: (
        <div className="relative flex shrink-0">
          <span className="relative z-10 h-9 w-9 overflow-hidden rounded-full ring-2 ring-white">
            <Image
              src={maya.imageUrl}
              alt=""
              width={72}
              height={72}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="-ml-3 relative z-0 h-9 w-9 overflow-hidden rounded-full ring-2 ring-white">
            <Image
              src={clara.imageUrl}
              alt=""
              width={72}
              height={72}
              className="h-full w-full object-cover"
            />
          </span>
        </div>
      ),
      title: "Maya is typing…",
      subtitle: "Start the convo?",
    },
    {
      key: "joined",
      icon: (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
          <AudioWaveform className="h-5 w-5" strokeWidth={2} />
        </span>
      ),
      title: "Clara just joined",
      subtitle: "Say hi 👋",
    },
    {
      key: "near",
      icon: (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-accentOrange shadow-sm">
          <Flame className="h-5 w-5" strokeWidth={2} />
        </span>
      ),
      title: "3 people near you",
      subtitle: "are online now",
    },
  ];

  return (
    <div className="px-5 pt-6">
      <div className="flex overflow-hidden rounded-2xl bg-lavender shadow-card">
        {cells.map((cell, i) => (
          <div
            key={cell.key}
            className={`flex min-w-0 flex-1 flex-col gap-2 px-3 py-3.5 ${i > 0 ? "border-l border-white/60" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              {cell.icon}
              {cell.key === "typing" && (
                <span className="shrink-0 text-[13px] font-medium text-ink/35">
                  ·
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">
                  {cell.title}
                </p>
                <p className="truncate text-[11px] text-inkMuted">{cell.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
