import { OperatorInbox } from "@/components/operator/operator-inbox";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";

export default function OperatorInboxPage() {
  return (
    <div>
      {!isManualOperatorMode() && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Zet <code className="font-mono">MANUAL_OPERATOR_MODE=1</code> in{" "}
          <code className="font-mono">.env.local</code> om automatische AI-replies
          uit te schakelen. Operator-API werkt ook zonder, maar users kunnen nog
          AI-berichten ontvangen.
        </div>
      )}
      <OperatorInbox />
    </div>
  );
}
