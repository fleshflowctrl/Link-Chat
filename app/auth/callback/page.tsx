import { Suspense } from "react";
import { AuthCallbackFinish } from "@/components/auth/auth-callback-finish";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#E4DFD4] px-4">
      <Suspense
        fallback={
          <p className="rounded-2xl bg-canvas px-6 py-4 text-sm text-inkMuted shadow-card ring-1 ring-black/[0.06]">
            Completing sign-in…
          </p>
        }
      >
        <AuthCallbackFinish />
      </Suspense>
    </div>
  );
}
