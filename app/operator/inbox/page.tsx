import { OperatorInbox } from "@/components/operator/operator-inbox";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";

export default function OperatorInboxPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!isManualOperatorMode() && (
        <div className="mb-2 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 sm:mb-4 sm:px-4 sm:py-3 sm:text-sm">
          Zet <code className="font-mono">MANUAL_OPERATOR_MODE=1</code> in{" "}
          <code className="font-mono">.env.local</code> om automatische AI-replies
          uit te schakelen. Operator-API werkt ook zonder, maar users kunnen nog
          AI-berichten ontvangen.
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <OperatorInbox />
      </div>
    </div>
  );
}
