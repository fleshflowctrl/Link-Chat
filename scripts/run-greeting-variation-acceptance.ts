import { runGreetingVariationAcceptance } from "../lib/ai/greeting-variation-acceptance";

async function main() {
  const r = await runGreetingVariationAcceptance();
  console.log("Greetings:", r.greetings.join(" | "));
  if (r.passed) {
    console.log("PASS greeting variation");
    process.exit(0);
  }
  for (const e of r.errors) console.log(`FAIL: ${e}`);
  process.exit(1);
}

main();
