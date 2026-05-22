/**
 * Run chat turn acceptance fixtures.
 * Usage: npx tsx scripts/run-chat-acceptance.ts
 */
import { runAcceptanceChecks } from "../lib/ai/chat-turn-acceptance";

async function main() {
  const results = await runAcceptanceChecks();
  let failed = 0;
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`${mark} ${r.id}: intent=${r.planIntent}`);
    console.log(`  final: ${r.finalText.slice(0, 120)}`);
    if (!r.passed) {
      failed++;
      for (const e of r.errors) console.log(`  - ${e}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
