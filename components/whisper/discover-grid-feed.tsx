"use client";

import type { Profile } from "@/data/profiles";
import { PersonalizedProfileGrid } from "./personalized-profile-grid";

type Props = {
  profiles: Profile[];
  initialViewerIsPermanent?: boolean;
};

/**
 * v2 discover: all profiles on one scrollable page. User picks who to chat with.
 */
export function DiscoverGridFeed({
  profiles,
  initialViewerIsPermanent = false,
}: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-4">
        {profiles.length === 0 ? (
          <p className="px-4 pt-2 text-center text-[13px] text-inkMuted">
            Geen profielen beschikbaar. Probeer later opnieuw.
          </p>
        ) : (
          <PersonalizedProfileGrid
            profiles={profiles}
            primaryAction="chat"
            initialViewerIsPermanent={initialViewerIsPermanent}
          />
        )}
      </div>
    </section>
  );
}
