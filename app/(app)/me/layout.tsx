import { MeAuthGateView } from "@/components/me/me-auth-gate-view";
import { resolveMeAccess } from "@/lib/me/resolve-me-access";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolveMeAccess();
  if (access.requiresAuthGate) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MeAuthGateView
          variant={access.variant}
          returnPath={access.returnPath}
        />
      </div>
    );
  }
  return children;
}
