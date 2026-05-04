import Image from "next/image";
import { Plus } from "lucide-react";
import { stories } from "@/data/stories";

const labelClass: Record<string, string> = {
  purple: "bg-primary/12 text-primary ring-1 ring-primary/20",
  pink: "bg-accentPink/12 text-accentPink ring-1 ring-accentPink/25",
  orange: "bg-accentOrange/12 text-accentOrange ring-1 ring-accentOrange/25",
  none: "text-ink/75",
};

function OnlineDot() {
  return (
    <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-accentGreen shadow-sm" />
  );
}

export function StoriesRail() {
  return (
    <div className="pt-6">
      <div className="scrollbar-hide flex gap-4 overflow-x-auto px-5 pb-1">
        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-left"
          >
            <div className="relative">
              <div className="rounded-full bg-gradient-ring p-[2.5px] shadow-card">
                <div className="relative h-[68px] w-[68px] overflow-hidden rounded-full bg-canvas">
                  {story.kind === "add_yours" ? (
                    <div className="h-full w-full bg-gradient-to-br from-lavender via-lavenderDeep/60 to-white/80" />
                  ) : (
                    <Image
                      src={story.imageUrl!}
                      alt=""
                      width={136}
                      height={136}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>
              {story.kind !== "add_yours" && <OnlineDot />}
              {story.kind === "add_yours" && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-white shadow-md ring-[3px] ring-canvas">
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2.75} />
                </span>
              )}
            </div>
            <span
              className={`w-full truncate rounded-full px-2 py-0.5 text-center text-[10px] font-semibold leading-tight ${labelClass[story.labelTone] ?? "text-ink/70"}`}
            >
              {story.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
