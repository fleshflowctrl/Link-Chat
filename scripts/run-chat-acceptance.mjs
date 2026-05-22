/**
 * Run chat turn acceptance fixtures.
 * Usage: node scripts/run-chat-acceptance.mjs
 * Requires: npx tsx (npx tsx scripts/run-chat-acceptance.ts) if using .ts wrapper
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

async function main() {
  const { register } = await import("tsx/esm/api").catch(() => null);
  if (!register) {
    console.error("Install tsx: npm i -D tsx  — or run: npx tsx scripts/run-chat-acceptance.ts");
    process.exit(1);
  }
  register();
  const { runAcceptanceChecks } = await import("../lib/ai/chat-turn-acceptance.ts");
  const results = await runAcceptanceChecks();
  let failed = 0;
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    console.log(`${mark} ${r.id}: ${r.planIntent} → ${r.finalText.slice(0, 80)}`);
    if (!r.passed) {
      failed++;
      for (const e of r.errors) console.log("  ", e);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
