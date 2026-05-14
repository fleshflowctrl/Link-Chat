"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  COMPLETENESS_FIELDS,
  getProfileCompleteness,
} from "@/lib/me/profile-completeness";
import type { EditProfileState } from "@/data/me-edit";

const DISMISS_KEY = "whisper:profile-strength-banner-dismissed";

/**
 * Slim, dismissible nudge that appears on /discover when the signed-in user's
 * profile is < 50% complete. Hidden on guest accounts (no fetch result) and
 * once the user dismisses it (per session).
 *
 * Opens /me/edit?focus=<top-missing-field> so the user lands on the right
 * block.
 */
export function ProfileStrengthBanner() {
  const [profile, setProfile] = useState<EditProfileState | null>(null);
  const [dismissed, setDismissed] = useState(true); // start hidden until we know

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem(DISMISS_KEY);
      setDismissed(flag === "1");
    } catch {
      /* ignore */
    }

    let cancelled = false;
    void fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: EditProfileState } | null) => {
        if (cancelled || !data?.profile) return;
        setProfile(data.profile);
      })
      .catch(() => {
        /* leave hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile || dismissed) return null;

  const report = getProfileCompleteness(profile);
  if (report.percent >= 50) return null;

  const top = report.nextSteps[0];
  if (!top) return null;

  // Total credits still on the table.
  const stillOnTable = report.nextSteps.reduce(
    (sum, f) => sum + f.reward,
    0,
  );

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] px-4 py-3 text-white shadow-md">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base"
          aria-hidden
        >
          {top.emoji}
        </span>
        <Link href={`/me/edit?focus=${top.focus}`} className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold leading-tight">
            {top.cta}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-white/85">
            Profielsterkte {report.percent}%
            {stillOnTable > 0 && (
              <>
                {" "}
                · verdien <span className="font-bold">{stillOnTable} credits</span>
              </>
            )}
          </p>
        </Link>
        <Link
          href={`/me/edit?focus=${top.focus}`}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#7C5CFF] shadow-sm active:scale-95"
        >
          Doen
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Sluiten"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-90"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// Re-export so call-sites importing only this banner can also list fields.
export { COMPLETENESS_FIELDS };
