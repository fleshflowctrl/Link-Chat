"use client";

import { useEffect, useMemo, useState } from "react";
import type { Profile } from "@/data/profiles";
import { loadDiscoveryPreferences } from "@/lib/discovery-preferences";
import { sortProfilesForPreferences } from "@/lib/personalize-feed";
import { ProfileGrid } from "./profile-grid";

export function PersonalizedProfileGrid({ profiles }: { profiles: Profile[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const sorted = useMemo(() => {
    if (!mounted) return profiles;
    return sortProfilesForPreferences(
      profiles,
      loadDiscoveryPreferences(),
    );
  }, [mounted, profiles]);

  return <ProfileGrid profiles={sorted} />;
}
