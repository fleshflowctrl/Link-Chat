import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function V2SignupPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#1D1D1E] px-4 py-10">
      <div className="w-full max-w-[430px]">
        <Suspense
          fallback={
            <div className="rounded-2xl bg-[#252526] p-8 text-center text-sm text-inkMuted ring-1 ring-white/10">
              Laden…
            </div>
          }
        >
          <LoginForm mode="signup" appVariant="v2" />
        </Suspense>
      </div>
    </div>
  );
}
