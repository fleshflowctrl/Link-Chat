import Link from "next/link";
import { SignOutButton } from "@/components/me/sign-out-button";

export default function MeAccountPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-8">
      <h1 className="text-xl font-bold text-ink">Account & beveiliging</h1>
      <p className="text-sm text-inkMuted">
        Je bent ingelogd met een magische link. Log hieronder uit op dit apparaat.
      </p>
      <SignOutButton />
      <Link
        href="/me"
        className="inline-flex min-h-[44px] max-w-xs items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Terug naar profiel
      </Link>
    </div>
  );
}
