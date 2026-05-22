import { runManualOperatorLogicAcceptance } from "../lib/operator/manual-operator-acceptance";

const results = runManualOperatorLogicAcceptance();
let failed = 0;
for (const r of results) {
  console.log(`${r.passed ? "PASS" : "FAIL"} ${r.id}: ${r.detail ?? ""}`);
  if (!r.passed) failed++;
}
console.log(`\n${results.length - failed}/${results.length} logic checks`);
process.exit(failed > 0 ? 1 : 0);
