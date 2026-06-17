import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  findLatestUserMessageNeedingReply,
  processOperatorAutoReply,
  processPendingOperatorAutoReplies,
} from "../lib/operator/process-operator-auto-reply";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (process.argv.includes("--fix")) {
    await sb.from("operator_app_settings").upsert(
      { id: 1, ai_auto_reply_enabled: true, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    const { data: reset } = await sb
      .from("chat_operator_queue")
      .update({
        operator_status: "waiting_operator",
        needs_operator_reply: true,
        updated_at: new Date().toISOString(),
      })
      .eq("operator_status", "ai_processing")
      .select("peer_id");
    console.log("enabled ai_auto + reset stuck:", reset?.map((r) => r.peer_id));
  }

  const { data: settings } = await sb
    .from("operator_app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  console.log("ai_auto_reply_enabled:", settings?.ai_auto_reply_enabled);

  const { data: queue } = await sb
    .from("chat_operator_queue")
    .select("*")
    .eq("needs_operator_reply", true)
    .order("last_user_message_at", { ascending: false, nullsFirst: false })
    .limit(5);

  console.log("\nPending queue rows:", queue?.length ?? 0);
  for (const row of queue ?? []) {
    console.log({
      peer_id: row.peer_id,
      status: row.operator_status,
      needs: row.needs_operator_reply,
      last_user: row.last_user_message_at,
      updated: row.updated_at,
    });

    const { data: history } = await sb
      .from("chat_messages")
      .select("id, sender, body, created_at")
      .eq("owner_user_id", row.owner_user_id)
      .eq("peer_id", row.peer_id)
      .order("created_at", { ascending: true });

    const pending = findLatestUserMessageNeedingReply(
      (history ?? []) as Parameters<typeof findLatestUserMessageNeedingReply>[0],
    );
    console.log("  pending user msg:", pending?.id, pending?.body?.slice(0, 40));

    if (process.argv.includes("--run")) {
      console.log("  -> running processOperatorAutoReply...");
      const result = await processOperatorAutoReply(sb, {
        ownerUserId: row.owner_user_id as string,
        peerId: row.peer_id as string,
      });
      console.log("  -> result:", result);
    }
  }

  if (process.argv.includes("--batch")) {
    const batch = await processPendingOperatorAutoReplies(sb, {
      limit: 4,
      maxBatches: 2,
    });
    console.log("\nbatch:", batch);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
