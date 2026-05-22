import { OperatorInbox } from "@/components/operator/operator-inbox";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";

export default function OperatorInboxPage() {
  return (
    <div className="flex min-h-0 min-h-dvh flex-1 flex-col">
      {!isManualOperatorMode() && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900">
          Zet <code className="font-mono">MANUAL_OPERATOR_MODE=1</code> om auto-AI uit te zetten.
        </div>
      )}
      <OperatorInbox />
    </div>
  );
}
