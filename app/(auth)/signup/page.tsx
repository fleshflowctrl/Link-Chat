import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-[#252526] p-8 text-center text-sm text-inkMuted ring-1 ring-white/10">
          Laden…
        </div>
      }
    >
      <LoginForm mode="signup" appVariant="v2" />
    </Suspense>
  );
}
