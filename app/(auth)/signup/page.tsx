import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl bg-canvas p-8 text-center text-sm text-inkMuted shadow-card ring-1 ring-black/[0.06]">
          Loading…
        </div>
      }
    >
      <LoginForm mode="signup" />
    </Suspense>
  );
}
