/**
 * Shared "generate the AI peer reply now" pipeline. Both the synchronous POST
 * /messages flow and the async pending-reply delivery (POST /poll-pending,
 * lazy GET catch-up) call into this so the prompt-build / Grok-call /
 * postprocess / revise / DB-insert / log-insert sequence stays in one place.
 *
 * Realism v7 adds:
 *   - relationship-stage drift (daysActive)
 *   - structured memory (facts / loops / inside jokes)
 *   - anti-loop banned-phrases list from recent peer replies
 *   - multi-message split (chunks[1..] queued via chat_pending_replies)
 *   - read receipts (set peer_read_at on user messages this reply addresses)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_CHAT_PROMPT_VERSION,
  buildGrokSystemPrompt,
} from "@/lib/ai/build-grok-system-prompt";
import {
  isV2ChatProfile,
  v2ChatUsesBlankSlate,
} from "@/lib/ai/v2-chat-config";
import { userMessagesSinceLastPeerReply } from "@/lib/ai/coalesce-user-reply";
import {
  RECENT_MESSAGE_COUNT,
  refreshThreadSummaryIfNeeded,
  sliceRecentDialogue,
  type ThreadMemoryRow,
} from "@/lib/ai/thread-memory";
import {
  refreshStructuredMemoryIfNeeded,
  V2_STRUCTURED_MEMORY_REFRESH_DELTA,
  hasAnyFacts,
  type StructuredMemoryRow,
  type StructuredFacts,
} from "@/lib/ai/structured-memory";
import {
  refreshPersonaSelfMemoryIfNeeded,
  hasAnySelfClaims,
  type PersonaSelfMemoryRow,
  type PersonaSelfFacts,
} from "@/lib/ai/persona-self-memory";
import { refreshUserChatPersonaIfNeeded } from "@/lib/ai/user-cross-chat-profile";
import type { UserChatPersonaRow } from "@/lib/ai/user-cross-chat-profile";
import {
  endsWithQuestion,
  hasEmoji,
  postProcessReply,
  MULTI_MESSAGE_SEPARATOR,
  splitMultiMessage,
} from "@/lib/ai/post-process-reply";
import { buildChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import {
  createChatTurnDebug,
  logChatTurnDebug,
} from "@/lib/ai/chat-turn-debug";
import { sliceRecentTurns } from "@/lib/ai/conversation-state-guard";
import { extractBotSessionFacts } from "@/lib/ai/session-fact-consistency-guard";
import { applyFinalCoherenceValidator } from "@/lib/ai/final-coherence-validator";
import { applyEllipsisRealismGuard } from "@/lib/ai/ellipsis-realism-guard";
import { applyEmojiRealismGuard } from "@/lib/ai/emoji-realism-guard";
import { applyLightTextCleanup } from "@/lib/ai/light-text-cleanup";
import { applyLanguageCleanupPass } from "@/lib/ai/language-cleanup";
import { validateChatQuality } from "@/lib/ai/chat-quality-gate";
import { fallbackResponseForPlan } from "@/lib/ai/chat-turn-fallbacks";
import type { FallbackPersonaContext } from "@/lib/ai/chat-turn-fallbacks";
import { logTemplateFallback } from "@/lib/ai/template-fallback-log";
import { lastPeerMessageBodies } from "@/lib/ai/dutch-human-realism-rewriter";
import { applyVoiceFingerprint, resolveVoiceFingerprint } from "@/lib/ai/voice-fingerprint";
import { computeEnergy, getHourInTimeZone } from "@/lib/ai/energy-curve";
import {
  isDraftReviseEnabled,
  reviseDraftIfWorthIt,
  reviseDraftLight,
} from "@/lib/ai/draft-revise";
import { getBedtimeContext } from "@/lib/ai/bedtime";
import { getWorkContext } from "@/lib/ai/work-schedule";
import { BOT_PEER_PHOTOS_ENABLED } from "@/lib/ai/bot-chat-photos";
import { extractPhotoDirective } from "@/lib/ai/photo-directive";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { scheduleUnreadEmailNotification } from "@/lib/chat/schedule-unread-email-notification";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { hasConversationBond } from "@/lib/ai/conversation-bond";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";
import { operatorSuggestionToneAppend } from "@/lib/operator/operator-suggestion-prompt";

function buildPersonaFallbackCtx(
  profile: ChatProfileRow,
  peerId: string,
  history: ChatMessageRow[],
  userMessage: string,
  flirtLevel?: string,
  bond?: boolean,
): FallbackPersonaContext {
  return {
    peerId,
    conversationId: peerId,
    personaName: profile.display_name,
    chatStyle: profile.chat_style ?? null,
    age: profile.age ?? null,
    city: profile.city ?? null,
    vibeTags: profile.vibe_tags ?? null,
    flirtLevel,
    bondFormed: bond,
    recentBotMessages: lastPeerMessageBodies(history, 8),
    userMessage,
  };
}
import {
  buildFollowUpContext,
  followUpExtraBannedPhrases,
  followUpSyntheticUserTurn,
  pickFollowUpAngle,
  type FollowUpKind,
} from "@/lib/ai/follow-up-reply";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

const FOLLOW_UP_MAX_CHARS = 180;

function personaTimeZone(_profile: ChatProfileRow): string {
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  if (env) return env;
  return "Europe/Amsterdam";
}

/** Days since the very first user message in this thread. Drives the
 * relationship-stage drift in the prompt. */
function computeDaysActive(history: ChatMessageRow[]): number {
  let firstUserAt: number | null = null;
  for (const row of history) {
    if (row.sender === "me") {
      const t = new Date(row.created_at).getTime();
      if (Number.isFinite(t)) {
        firstUserAt = t;
        break;
      }
    }
  }
  if (firstUserAt === null) return 0;
  const ms = Date.now() - firstUserAt;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Pull short n-gram phrases (3-6 words) from the most recent peer replies
 * that have appeared more than once. These are catchphrases the persona
 * has fallen into and we want her to vary away from. Conservative: only
 * banned if appears 2+ times within the last 8 peer messages. */
function extractBannedPhrases(history: ChatMessageRow[], lookback = 8): string[] {
  const peerBodies: string[] = [];
  for (let i = history.length - 1; i >= 0 && peerBodies.length < lookback; i--) {
    const row = history[i];
    if (row.sender !== "peer" || row.kind !== "text") continue;
    const body = (row.body ?? "").trim();
    if (body) peerBodies.push(body.toLowerCase());
  }
  if (peerBodies.length < 2) return [];

  const counts = new Map<string, number>();
  for (const body of peerBodies) {
    const tokens = body
      .replace(/[.,!?;:()"\u2018\u2019\u201C\u201D]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    // 3- and 4-word n-grams
    for (let n = 3; n <= 4; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n).join(" ");
        if (gram.length < 8 || gram.length > 40) continue;
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }
    // Also single short tokens that are common AI tells when overused
    for (const tok of tokens) {
      if (tok.length >= 3 && tok.length <= 14) {
        counts.set(tok, (counts.get(tok) ?? 0) + 1);
      }
    }
  }

  // Filter to phrases that appeared 2+ times AND are notably "tic-y" (not
  // generic stop-words).
  const STOP = new Set([
    "ja", "nee", "een", "het", "een", "dat", "wat", "ik", "je", "we",
    "voor", "naar", "ben", "is", "ook", "als", "van", "met", "die",
    "maar", "deze", "ook", "nog", "hier", "daar",
  ]);
  const banned: Array<[string, number]> = [];
  counts.forEach((c, phrase) => {
    if (c < 2) return;
    if (phrase.split(/\s+/).every((w: string) => STOP.has(w))) return;
    banned.push([phrase, c]);
  });
  banned.sort((a, b) => b[1] - a[1]);
  return banned.slice(0, 8).map(([p]) => p);
}

/** Heuristic: is the user's last message emotionally weighted enough to
 * warrant a pre-ack? Cheap signals only — no model call. */
function isEmotionalUserMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  const t = body.trim();
  if (t.length < 30) return false;
  const lc = t.toLowerCase();
  if (
    /[!?]{2,}|\.{3,}/.test(t) ||
    /(echt waar|serieus|niet te geloven|ben (super )?(blij|trots|geraakt)|verdrietig|kwijt|gemist|huilen|zwaar|moeilijk|stress|angst)/i.test(lc) ||
    /(ik heb|ik wou|ik wilde|net gehoord|kwam ineens|vandaag was)/i.test(lc)
  ) {
    return true;
  }
  return false;
}

/** Decide whether to allow Grok to split into multiple bubbles for this
 * turn. We suppress splitting in moments where one cohesive message reads
 * better (hook, goodnight, post-sleep wakeup). */
function decideMultiMessage(args: {
  turnIndex: number;
  bedtimePhase: "awake" | "approaching" | "asleep";
  emotional: boolean;
}): boolean {
  if (args.turnIndex < 3) return false; // hook stays a single warm reply
  if (args.bedtimePhase === "approaching") return false; // goodnight = one msg
  if (args.bedtimePhase === "asleep") return false; // morning-after = one msg
  // 70% allowed for casual turns, 30% for emotional (still useful for pre-ack)
  return Math.random() < (args.emotional ? 0.5 : 0.7);
}

/** Decide whether this turn should be a "burst" (4-6 fast chunks).
 *
 * Operator brief: "soms 2 minuten waarin ze ineens 4 tot 6 berichten in
 * korte tijd stuurt, het moet extreem realistisch zijn". This models the
 * real "she's excited and texting 5 short messages in a row" pattern.
 *
 * Constraints:
 *   - Past the hook turns (so the hook itself stays a single warm message)
 *   - Not bedtime-approaching / asleep (those want a single closure)
 *   - Not emotional (those want a measured single reply, not a waterfall)
 *   - Not actively working unless we're in sneaky-glance mode (and even
 *     then a burst on a sneaky glance feels off — she'd send 1 quick msg)
 *   - Roughly 1 in 14 turns when conditions are right
 *
 * Returns false unless allowMultiMessage already true — burst implies
 * multi-message.
 *
 * Override via env XAI_BURST_PROBABILITY="0.07" if needed. */
/** Decide whether this turn should be terse (1-3 word reply or emoji-only).
 *
 * Realism v2: the most consistent AI tell is "every reply is 2-3 nicely
 * structured sentences". Real people drop "lol", "🙄", "jaaa" sometimes
 * and that's it. We allow this when:
 *   - past hook turns
 *   - not bedtime-approaching (goodnight needs warmth)
 *   - not pre-ack mode / not emotional (those want substance)
 *   - not burst mode
 *   - energy state suggests it (groggy / busy / tired multiplies probability)
 *   - the user's last message is short and casual itself (~ <40 chars or 1-3 words)
 *
 * Base probability: 8%. Multiplied by the energy state's terseFactor.
 */
function decideTerseMode(args: {
  turnIndex: number;
  bedtimePhase: "awake" | "approaching" | "asleep";
  burstMode: boolean;
  emotional: boolean;
  lastUserBody: string | null;
  energyTerseFactor: number;
}): boolean {
  if (args.turnIndex < 3) return false;
  if (args.bedtimePhase !== "awake") return false;
  if (args.burstMode) return false;
  if (args.emotional) return false;
  // Don't go terse if the user wrote something substantial worth answering.
  const lastTrim = (args.lastUserBody ?? "").trim();
  if (lastTrim.length === 0) return false;
  const isQuestion = /[?!]\s*$/.test(lastTrim) && lastTrim.length > 12;
  if (isQuestion) return false;
  // Encourage terse when the user himself sent something terse.
  const isShort = lastTrim.length <= 32 || lastTrim.split(/\s+/).length <= 4;
  let p = 0.08 * args.energyTerseFactor;
  if (isShort) p *= 1.8;
  if (p > 0.45) p = 0.45;
  return Math.random() < p;
}

function decideBurstMode(args: {
  allowMultiMessage: boolean;
  turnIndex: number;
  bedtimePhase: "awake" | "approaching" | "asleep";
  workPhase:
    | "off"
    | "approaching_work"
    | "working"
    | "break"
    | "lunch_break"
    | "ending_work";
  emotional: boolean;
}): boolean {
  if (!args.allowMultiMessage) return false;
  if (args.turnIndex < 3) return false;
  if (args.bedtimePhase !== "awake") return false;
  if (args.workPhase === "working" || args.workPhase === "approaching_work") return false;
  if (args.emotional) return false;
  const raw = process.env.XAI_BURST_PROBABILITY;
  let p = 0.07;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) p = n;
  }
  return Math.random() < p;
}

export type GeneratePeerReplyResult =
  | {
      ok: true;
      draftOnly?: false;
      assistantRow: ChatMessageRow;
      finalText: string;
      revised: boolean;
      latencyMs: number;
      model: string;
      turnIndex: number;
      userSilenceMs: number | null;
      additionalChunks: number;
      nextChunkAt: string | null;
    }
  | {
      ok: true;
      draftOnly: true;
      draftText: string;
      finalText: string;
      revised: boolean;
      latencyMs: number;
      model: string;
      turnIndex: number;
      userSilenceMs: number | null;
      additionalChunks: 0;
      nextChunkAt: null;
    }
  | {
      ok: false;
      error: string;
      latencyMs: number;
      model: string;
    };

export function isPersistedPeerReply(
  result: GeneratePeerReplyResult,
): result is Extract<GeneratePeerReplyResult, { ok: true }> & {
  assistantRow: ChatMessageRow;
} {
  return result.ok && !("draftOnly" in result && result.draftOnly === true);
}

export type GeneratePeerReplyOptions = {
  triggerUserMessageId?: string;
  forceSingleMessage?: boolean;
  pendingKind?: FollowUpKind;
  /** Build reply text only — no chat_messages / pending inserts (operator suggest). */
  draftOnly?: boolean;
  /** Operator inbox: extra context (saved summary, thread memory). */
  operatorContextBlock?: string;
  /** Operator inbox: tone variant for one of three suggestions. */
  operatorSuggestionTone?: "playful" | "warm" | "direct";
  /** Operator suggest: run draft-revise even when XAI_DRAFT_REVISE is off. */
  forceDraftRevise?: boolean;
  /** Operator suggest: read memory for prompt but skip DB upserts (parallel-safe). */
  skipMemoryPersistence?: boolean;
  /** Operator inbox / AI auto — warmer length + smart follow-up questions */
  operatorSuggestMode?: boolean;
  /** Skip memory refresh when operator batch already prepared context once. */
  preloadedMemory?: PreloadedReplyMemory;
  /** Cheaper draft-revise without resending the full system prompt. */
  lightDraftRevise?: boolean;
  maxOutputTokens?: number;
};

export type PreloadedReplyMemory = {
  memory: ThreadMemoryRow;
  structured: StructuredMemoryRow;
  userCrossChatProfile: UserChatPersonaRow | null;
  personaSelfMem: PersonaSelfMemoryRow;
};

type MemoryRow = {
  summary?: string;
  prefix_messages_count?: number;
  structured_facts?: unknown;
  persona_self_facts?: unknown;
};

function parseMemoryRow(m: MemoryRow | null): {
  prevMemory: ThreadMemoryRow | null;
  prevStructured: StructuredMemoryRow | null;
  prevSelfMemory: PersonaSelfMemoryRow | null;
} {
  const prevMemory: ThreadMemoryRow | null =
    m && typeof m.summary === "string" && typeof m.prefix_messages_count === "number"
      ? { summary: m.summary, prefix_messages_count: m.prefix_messages_count }
      : null;
  const prevStructured: StructuredMemoryRow | null = (() => {
    if (!m || !m.structured_facts || typeof m.structured_facts !== "object") {
      return null;
    }
    const facts = m.structured_facts as StructuredFacts;
    const sfPrefix =
      typeof (facts as Record<string, unknown>).__prefix === "number"
        ? ((facts as Record<string, unknown>).__prefix as number)
        : 0;
    const cleanFacts: StructuredFacts = { ...facts };
    delete (cleanFacts as Record<string, unknown>).__prefix;
    return { facts: cleanFacts, prefix_messages_count: sfPrefix };
  })();
  const prevSelfMemory: PersonaSelfMemoryRow | null = (() => {
    if (!m || !m.persona_self_facts || typeof m.persona_self_facts !== "object") {
      return null;
    }
    const facts = m.persona_self_facts as PersonaSelfFacts & { __prefix?: number };
    const pfx = typeof facts.__prefix === "number" ? facts.__prefix : 0;
    const clean: PersonaSelfFacts = { self_claims: facts.self_claims };
    return { facts: clean, prefix_messages_count: pfx };
  })();
  return { prevMemory, prevStructured, prevSelfMemory };
}

async function persistReplyMemory(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    memory: ThreadMemoryRow;
    structured: StructuredMemoryRow;
    personaSelfMem: PersonaSelfMemoryRow;
  },
): Promise<void> {
  const memoryUpsertBase = {
    owner_user_id: args.ownerUserId,
    peer_id: args.peerId,
    summary: args.memory.summary,
    prefix_messages_count: args.memory.prefix_messages_count,
    updated_at: new Date().toISOString(),
  };
  const { error: memUpsertErr } = await supabase
    .from("chat_ai_thread_memory")
    .upsert(
      {
        ...memoryUpsertBase,
        structured_facts: {
          ...args.structured.facts,
          __prefix: args.structured.prefix_messages_count,
        },
        persona_self_facts: {
          ...args.personaSelfMem.facts,
          __prefix: args.personaSelfMem.prefix_messages_count,
        },
      },
      { onConflict: "owner_user_id,peer_id" },
    );
  if (memUpsertErr && /persona_self_facts/i.test(memUpsertErr.message)) {
    console.warn(
      "[generate-peer-reply] persona_self_facts column missing — apply 20260516200000_chat_realism_v2.sql",
    );
    const { error: retryErr } = await supabase
      .from("chat_ai_thread_memory")
      .upsert(
        {
          ...memoryUpsertBase,
          structured_facts: {
            ...args.structured.facts,
            __prefix: args.structured.prefix_messages_count,
          },
        },
        { onConflict: "owner_user_id,peer_id" },
      );
    if (retryErr && /structured_facts/i.test(retryErr.message)) {
      await supabase
        .from("chat_ai_thread_memory")
        .upsert(memoryUpsertBase, { onConflict: "owner_user_id,peer_id" });
    } else if (retryErr) {
      console.warn("[generate-peer-reply] memory upsert (v2 retry)", retryErr.message);
    }
  } else if (memUpsertErr && /structured_facts/i.test(memUpsertErr.message)) {
    console.warn(
      "[generate-peer-reply] structured_facts column missing — falling back to prose-only memory",
    );
    await supabase
      .from("chat_ai_thread_memory")
      .upsert(memoryUpsertBase, { onConflict: "owner_user_id,peer_id" });
  } else if (memUpsertErr) {
    console.warn("[generate-peer-reply] memory upsert", memUpsertErr.message);
  }
}

/** Load + refresh thread memory once (shared by operator suggestion batches). */
export async function prepareReplyMemoryContext(
  supabase: SupabaseClient,
  args: {
    history: ChatMessageRow[];
    ownerUserId: string;
    peerId: string;
    profile: ChatProfileRow;
    persist?: boolean;
    /** Skip Grok memory-refresh calls (faster operator auto-reply). */
    skipRefresh?: boolean;
  },
): Promise<PreloadedReplyMemory> {
  const { data: memRow } = await supabase
    .from("chat_ai_thread_memory")
    .select("*")
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .maybeSingle();

  const { prevMemory, prevStructured, prevSelfMemory } = parseMemoryRow(
    (memRow ?? null) as MemoryRow | null,
  );

  if (args.skipRefresh) {
    const { data: personaRow } = await supabase
      .from("user_chat_persona")
      .select("*")
      .eq("user_id", args.ownerUserId)
      .maybeSingle();
    return {
      memory: prevMemory ?? { summary: "", prefix_messages_count: 0 },
      structured: prevStructured ?? { facts: {}, prefix_messages_count: 0 },
      userCrossChatProfile: (personaRow as PreloadedReplyMemory["userCrossChatProfile"]) ?? null,
      personaSelfMem: prevSelfMemory ?? { facts: {}, prefix_messages_count: 0 },
    };
  }

  const [memory, structured, userCrossChatProfile, personaSelfMem] = await Promise.all([
    refreshThreadSummaryIfNeeded(args.history, prevMemory).catch((): ThreadMemoryRow => ({
      summary: prevMemory?.summary ?? "",
      prefix_messages_count: prevMemory?.prefix_messages_count ?? 0,
    })),
    refreshStructuredMemoryIfNeeded(args.history, prevStructured, {
      refreshDelta: isV2ChatProfile(args.profile)
        ? V2_STRUCTURED_MEMORY_REFRESH_DELTA
        : undefined,
    }).catch(
      (): StructuredMemoryRow => prevStructured ?? { facts: {}, prefix_messages_count: 0 },
    ),
    refreshUserChatPersonaIfNeeded(supabase, args.ownerUserId).catch(() => null),
    refreshPersonaSelfMemoryIfNeeded(args.history, prevSelfMemory).catch(
      (): PersonaSelfMemoryRow => prevSelfMemory ?? { facts: {}, prefix_messages_count: 0 },
    ),
  ]);

  if (args.persist !== false) {
    await persistReplyMemory(supabase, {
      ownerUserId: args.ownerUserId,
      peerId: args.peerId,
      memory,
      structured,
      personaSelfMem,
    });
  }

  return { memory, structured, userCrossChatProfile, personaSelfMem };
}

/**
 * Run the full generate-and-persist pipeline. Returns success with the
 * inserted assistant row (the FIRST chunk of the reply if split) plus
 * counts on any additional chunk-rows queued for delayed delivery.
 *
 * Side-effects:
 *   - upserts chat_ai_thread_memory (prose + structured)
 *   - inserts chat_messages (one or more peer rows)
 *   - inserts chat_pending_replies (kind='chunk') for additional bubbles
 *   - sets peer_read_at on user messages this reply addresses
 *   - inserts ai_chat_turn_logs
 */
export async function generatePeerReply(
  supabase: SupabaseClient,
  args: {
    profile: ChatProfileRow;
    history: ChatMessageRow[];
    ownerUserId: string;
    peerId: string;
    options?: GeneratePeerReplyOptions;
  },
): Promise<GeneratePeerReplyResult> {
  const t0 = Date.now();
  const resolvedModel =
    process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";

  const triggerId = args.options?.triggerUserMessageId;
  const followUpKind = args.options?.pendingKind;
  const isFollowUp = Boolean(followUpKind);
  const draftOnly = Boolean(args.options?.draftOnly);

  if (isManualOperatorMode() && !draftOnly) {
    return {
      ok: false,
      error: "MANUAL_OPERATOR_MODE: automatic AI replies are disabled",
      latencyMs: 0,
      model: process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3",
    };
  }

  let memory: ThreadMemoryRow;
  let structured: StructuredMemoryRow;
  let userCrossChatProfile: UserChatPersonaRow | null;
  let personaSelfMem: PersonaSelfMemoryRow;

  if (args.options?.preloadedMemory) {
    ({ memory, structured, userCrossChatProfile, personaSelfMem } =
      args.options.preloadedMemory);
  } else {
    const loaded = await prepareReplyMemoryContext(supabase, {
      history: args.history,
      ownerUserId: args.ownerUserId,
      peerId: args.peerId,
      profile: args.profile,
      persist: !args.options?.skipMemoryPersistence,
    });
    memory = loaded.memory;
    structured = loaded.structured;
    userCrossChatProfile = loaded.userCrossChatProfile;
    personaSelfMem = loaded.personaSelfMem;
  }

  // Safer memory: older turns → prose summary in prompt; recent → verbatim in tail.
  const threadSummaryForPrompt =
    args.history.length > RECENT_MESSAGE_COUNT && memory.summary.trim()
      ? memory.summary.trim()
      : undefined;

  // ----- Turn-context -----
  let priorAssistantTurns = 0;
  let priorUserAt: number | null = null;
  let triggerUserAt: number | null = null;
  for (const row of args.history) {
    if (row.sender === "peer") priorAssistantTurns += 1;
    if (row.sender === "me") {
      const ts = new Date(row.created_at).getTime();
      if (Number.isFinite(ts)) {
        if (triggerId && row.id === triggerId) {
          triggerUserAt = ts;
        } else if (!triggerId || ts < (triggerUserAt ?? Number.POSITIVE_INFINITY)) {
          priorUserAt = priorUserAt === null ? ts : Math.max(priorUserAt, ts);
        }
      }
    }
  }
  if (triggerUserAt === null) {
    for (let i = args.history.length - 1; i >= 0; i--) {
      if (args.history[i].sender === "me") {
        const ts = new Date(args.history[i].created_at).getTime();
        if (Number.isFinite(ts)) {
          triggerUserAt = ts;
          break;
        }
      }
    }
  }
  const userSilenceMs =
    triggerUserAt !== null && priorUserAt !== null && triggerUserAt > priorUserAt
      ? triggerUserAt - priorUserAt
      : null;

  const peerLastReplyAtForBedtime = (() => {
    for (let i = args.history.length - 1; i >= 0; i--) {
      if (args.history[i].sender === "peer") {
        const t = new Date(args.history[i].created_at);
        if (!Number.isNaN(t.getTime())) return t;
        return null;
      }
    }
    return null;
  })();
  const personaTz = personaTimeZone(args.profile);
  const bedtime = getBedtimeContext({
    now: new Date(),
    timeZone: personaTz,
    personaId: args.peerId,
    peerLastReplyAt: peerLastReplyAtForBedtime,
  });
  // Work-context: derived from chat_profiles.occupation. Drives the
  // prompt-hint that tells Grok to reference her current work-state
  // ("ik moet zo werken", "tussen lessen door even"). Pacing
  // (computeReplyPacing) does its own getWorkContext call to clamp
  // the reply into break/end-of-shift windows; this one is for
  // prompt content only. Both should agree because both pass the
  // same persona id + tz + occupation.
  const workCtx = getWorkContext({
    now: new Date(),
    timeZone: personaTz,
    personaId: args.peerId,
    occupation:
      (args.profile as ChatProfileRow & { occupation?: string | null }).occupation ?? null,
  });

  // ----- New realism inputs -----
  const daysActive = computeDaysActive(args.history);
  const bondFormed = hasConversationBond(args.history);
  const followUpCtx = isFollowUp ? buildFollowUpContext(args.history) : null;
  const followUpAngle =
    isFollowUp && followUpKind
      ? pickFollowUpAngle(args.peerId, followUpKind)
      : undefined;
  const bannedPhrases = [
    ...extractBannedPhrases(args.history),
    ...(followUpCtx ? followUpExtraBannedPhrases(followUpCtx) : []),
    "ofzo",
    "of zo",
    "egt",
  ].filter((p, i, arr) => arr.indexOf(p) === i);
  const userBurst = userMessagesSinceLastPeerReply(args.history);
  const userMessagesSinceLastReply = userBurst.length;

  // Find last user message body for emotional detection.
  let lastUserBody: string | null = null;
  for (let i = args.history.length - 1; i >= 0; i--) {
    if (args.history[i].sender === "me") {
      lastUserBody = args.history[i].body ?? null;
      break;
    }
  }
  const emotional = isEmotionalUserMessage(lastUserBody);
  const v2BlankSlate = v2ChatUsesBlankSlate(args.profile);

  const allowMultiMessage = v2BlankSlate || isFollowUp
    ? false
    : !args.options?.forceSingleMessage &&
      decideMultiMessage({
        turnIndex: priorAssistantTurns,
        bedtimePhase: bedtime.phase,
        emotional,
      });
  const burstMode = v2BlankSlate || isFollowUp
    ? false
    : decideBurstMode({
        allowMultiMessage,
        turnIndex: priorAssistantTurns,
        bedtimePhase: bedtime.phase,
        workPhase: workCtx.phase,
        emotional,
      });

  const nowForEnergy = new Date();
  const { hour: hourLocal, dayOfWeek: dowLocal } = getHourInTimeZone(nowForEnergy, personaTz);
  const energy = computeEnergy({ hourLocal, dayOfWeek: dowLocal });

  const terseMode = v2BlankSlate || isFollowUp
    ? false
    : args.options?.operatorSuggestMode
      ? false
      : decideTerseMode({
        turnIndex: priorAssistantTurns,
        bedtimePhase: bedtime.phase,
        burstMode,
        emotional,
        lastUserBody,
        energyTerseFactor: energy.terseFactor,
      });

  const recentTurns = sliceRecentTurns(args.history, 12);
  const userBurstText = userBurst
    .map((m) => (m.body ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const chatTurnPlan = buildChatTurnPlan({
    currentUserMessage: userBurstText || (lastUserBody ?? ""),
    userBurstLines: userBurst.map((m) => (m.body ?? "").trim()).filter(Boolean),
    userBurstTimestamps: userBurst
      .map((m) => new Date(m.created_at).getTime())
      .filter((t) => Number.isFinite(t)),
    recentMessages: recentTurns,
    structuredFacts: hasAnyFacts(structured.facts) ? structured.facts : null,
    personaSelfFacts: hasAnySelfClaims(personaSelfMem.facts) ? personaSelfMem.facts : null,
    bondFormed,
    userFlirtLevel: userCrossChatProfile?.flirt_level,
    isFollowUp,
    operatorSuggestMode: args.options?.operatorSuggestMode,
  });

  const turnDebug = createChatTurnDebug(args.peerId, AI_CHAT_PROMPT_VERSION);
  turnDebug.chatTurnPlan = chatTurnPlan;
  turnDebug.userMessagesSinceLastPeerReply = userBurst
    .map((m) => (m.body ?? "").trim())
    .filter(Boolean);

  const userMsgForTurn = userBurstText || (lastUserBody ?? "");
  const personaFallbackCtx = buildPersonaFallbackCtx(
    args.profile,
    args.peerId,
    args.history,
    userMsgForTurn,
    userCrossChatProfile?.flirt_level,
    bondFormed,
  );

  const planOpts = { chatTurnPlan };

  // ----- Build prompt -----
  const bondOpts = { bondFormed };

  const followUpOpts =
    isFollowUp && followUpKind && followUpCtx
      ? {
          followUpKind,
          followUpContext: followUpCtx,
          followUpAngle,
          ...bondOpts,
        }
      : {};

  const system = buildGrokSystemPrompt(
    args.profile,
    v2BlankSlate
      ? {
          nowLocal: new Date(),
          turnIndex: priorAssistantTurns,
          userMessagesSinceLastReply,
          ...bondOpts,
          ...followUpOpts,
          ...planOpts,
        }
      : {
          threadSummary: threadSummaryForPrompt,
          nowLocal: new Date(),
          turnIndex: priorAssistantTurns,
          userMessagesSinceLastReply,
          userSilenceMs: userSilenceMs ?? undefined,
          bedtimePhase: bedtime.phase,
          minutesUntilBedtime: bedtime.minutesUntilBedtime,
          workPromptHint: bondFormed ? workCtx.promptHint : "",
          daysActive,
          bannedPhrases,
          structuredFacts: hasAnyFacts(structured.facts) ? structured.facts : null,
          userCrossChatProfile: userCrossChatProfile
            ? {
                summary: userCrossChatProfile.summary,
                traits: userCrossChatProfile.traits,
                topics: userCrossChatProfile.topics,
                flirt_level: userCrossChatProfile.flirt_level,
                communication_pace: userCrossChatProfile.communication_pace,
                message_length: userCrossChatProfile.message_length,
                wants: userCrossChatProfile.wants,
                avoids: userCrossChatProfile.avoids,
              }
            : null,
          allowMultiMessage: allowMultiMessage || burstMode,
          burstMode,
          preAckMode: false,
          energyHint: {
            state: energy.state,
            hint: energy.hint,
            lengthBias: args.options?.operatorSuggestMode ? "normal" : energy.lengthBias,
          },
          terseMode,
          personaSelfFacts: hasAnySelfClaims(personaSelfMem.facts)
            ? personaSelfMem.facts
            : null,
          ...bondOpts,
          ...followUpOpts,
          ...planOpts,
        },
  );

  let systemContent = system;
  if (args.options?.operatorContextBlock?.trim()) {
    systemContent += args.options.operatorContextBlock.trim();
  }
  if (args.options?.operatorSuggestionTone) {
    systemContent += operatorSuggestionToneAppend(args.options.operatorSuggestionTone);
  }

  const tail = sliceRecentDialogue(args.history);
  const visionIndices = new Set<number>();
  for (let i = tail.length - 1; i >= 0; i--) {
    const r = tail[i];
    if (
      r.sender === "me" &&
      r.kind === "image" &&
      typeof r.image_url === "string" &&
      /^https?:\/\//.test(r.image_url)
    ) {
      visionIndices.add(i);
      if (visionIndices.size >= 2) break;
    }
  }
  if (triggerId) {
    const ti = tail.findIndex((r) => r.id === triggerId);
    const tr = ti >= 0 ? tail[ti] : null;
    if (
      tr?.kind === "image" &&
      typeof tr.image_url === "string" &&
      /^https?:\/\//.test(tr.image_url)
    ) {
      visionIndices.add(ti);
    }
  }

  const input: GrokInputMessage[] = [
    { role: "system", content: systemContent },
    ...tail.map((r, i) => {
      const role = (r.sender === "me" ? "user" : "assistant") as "user" | "assistant";
      // Vision: attach pixels for at most the two latest user photos (plus the
      // trigger message) so xAI can see what she sent without overloading the call.
      if (visionIndices.has(i)) {
        const caption = (r.body ?? "").trim();
        const parts: Array<
          { type: "text"; text: string } | {
            type: "image_url";
            image_url: { url: string; detail: "high" };
          }
        > = [
          {
            type: "text",
            text: caption
              ? `(zij stuurde een foto met als tekst: "${caption}")`
              : "(zij stuurde een foto, geen tekst erbij)",
          },
          { type: "image_url", image_url: { url: r.image_url!, detail: "high" } },
        ];
        return { role: "user" as const, content: parts };
      }
      return {
        role,
        content:
          r.kind === "image"
            ? "[Sent a photo]"
            : (r.body ?? "").trim() || "…",
      };
    }),
  ];

  if (isFollowUp && followUpKind) {
    input.push({
      role: "user",
      content: followUpSyntheticUserTurn(followUpKind),
    });
  }

  // ----- Grok call -----
  let grok: Awaited<ReturnType<typeof grokResponsesComplete>>;
  try {
    grok = await grokResponsesComplete(input, {
      maxOutputTokens:
        args.options?.maxOutputTokens ??
        (args.options?.operatorSuggestMode ? 400 : undefined),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    grok = { ok: false as const, error: msg };
  }

  if (!grok.ok) {
    const latencyMs = Date.now() - t0;
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: resolvedModel,
      ok: false,
      error: grok.error,
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return { ok: false, error: grok.error, latencyMs, model: resolvedModel };
  }

  let draftText = grok.text;
  turnDebug.rawGrokResponse = draftText;
  let revised = false;

  if (!v2BlankSlate && !isFollowUp && (isDraftReviseEnabled() || args.options?.forceDraftRevise)) {
    try {
      const r = args.options?.lightDraftRevise
        ? await reviseDraftLight(draftText, args.profile.display_name)
        : await reviseDraftIfWorthIt(draftText, systemContent);
      draftText = r.text;
      revised = r.revised;
      turnDebug.afterDraftRevise = draftText;
    } catch {
      turnDebug.afterDraftRevise = draftText;
    }
  } else {
    turnDebug.afterDraftRevise = draftText;
  }

  const coherence = await applyFinalCoherenceValidator({
    chatTurnPlan,
    candidateBotResponse: draftText,
    recentMessages: recentTurns,
    currentUserMessage: userMsgForTurn,
    personaName: args.profile.display_name,
    personaCtx: personaFallbackCtx,
  });
  draftText = coherence.text;
  turnDebug.afterCoherence = draftText;
  turnDebug.finalCoherenceValid = coherence.valid;
  turnDebug.invalidReasons = coherence.reasons;
  turnDebug.correctedResponse = coherence.corrected ? draftText : "";
  if (coherence.corrected) {
    logTemplateFallback({
      fallbackUsed: true,
      fallbackReason: coherence.reasons.join("; "),
      selectedTemplate: draftText,
      peerId: args.peerId,
      personaName: args.profile.display_name,
      intent: chatTurnPlan.userIntent,
      rawGrokResponse: turnDebug.rawGrokResponse,
      finalResponse: draftText,
    });
  }

  draftText = applyLightTextCleanup(draftText, chatTurnPlan);
  turnDebug.afterLightCleanup = draftText;

  const splitCap = Math.min(
    chatTurnPlan.maxBubbles,
    burstMode ? 6 : allowMultiMessage ? 4 : 1,
  );
  const rawChunks = terseMode
    ? [draftText]
    : splitMultiMessage(draftText, Math.max(1, splitCap));

  // Photo directives can appear in any chunk. We extract them up front
  // so the visible chunk text stays clean, and we collect the scenes
  // along with their chunk-index so each photo arrives RIGHT AFTER the
  // text chunk it was attached to (preserves narrative flow).
  type PhotoIntent = { afterChunkIndex: number; scene: string };
  const photoIntents: PhotoIntent[] = [];
  const directiveStrippedChunks = rawChunks.map((c, idx) => {
    const ext = extractPhotoDirective(c);
    if (BOT_PEER_PHOTOS_ENABLED && ext.scene) {
      photoIntents.push({ afterChunkIndex: idx, scene: ext.scene });
    }
    return ext.cleanText;
  });

  let cleanedChunksRaw = directiveStrippedChunks
    .map((c) => postProcessReply(c))
    .filter((c) => c.length > 0);

  if (isFollowUp && cleanedChunksRaw.length > 0) {
    cleanedChunksRaw = [
      cleanedChunksRaw[0].slice(0, FOLLOW_UP_MAX_CHARS).trim(),
    ].filter((c) => c.length > 0);
  }

  // Voice fingerprint + language cleanup (no random typo injection).
  const fpCtx = {
    ownerUserId: args.ownerUserId,
    peerProfileId: args.peerId,
    messageIndex: priorAssistantTurns,
  };
  let cleanedChunks = v2BlankSlate
    ? applyLanguageCleanupPass(cleanedChunksRaw)
    : (() => {
        const resolvedStyle = resolveVoiceFingerprint(
          args.profile.chat_style ?? null,
          args.peerId,
        );
        const afterFp = applyVoiceFingerprint(cleanedChunksRaw, resolvedStyle, fpCtx);
        return applyLanguageCleanupPass(afterFp);
      })();

  const emojiGuard = applyEmojiRealismGuard({
    chunks: cleanedChunks,
    recentBotMessages: lastPeerMessageBodies(args.history, 8),
    currentUserMessage: userBurstText || (lastUserBody ?? ""),
    combinedUserIntent: chatTurnPlan.normalizedIntent.combinedUserIntent,
    userFlirtLevel: userCrossChatProfile?.flirt_level,
    bondFormed,
    personaEmojiPalette: Array.isArray(
      (args.profile.chat_style as { emoji_palette?: string[] } | null)?.emoji_palette,
    )
      ? (args.profile.chat_style as { emoji_palette: string[] }).emoji_palette
      : undefined,
  });
  cleanedChunks = emojiGuard.chunks;

  const ellipsisGuard = applyEllipsisRealismGuard({
    chunks: cleanedChunks,
    recentBotMessages: lastPeerMessageBodies(args.history, 12),
    currentUserMessage: userMsgForTurn,
    combinedUserIntent: chatTurnPlan.normalizedIntent.combinedUserIntent,
    chatTurnPlan,
    chatStyle: args.profile.chat_style ?? null,
    greetingPersona: personaFallbackCtx,
  });
  cleanedChunks = ellipsisGuard.chunks;

  const lastResort = validateChatQuality({
    currentUserMessage: userMsgForTurn,
    recentMessages: recentTurns,
    candidateBotResponse: cleanedChunks.join("\n"),
    normalizedIntent: chatTurnPlan.normalizedIntent,
    persona: {
      name: args.profile.display_name,
      flirtLevel: userCrossChatProfile?.flirt_level,
    },
    sessionFacts: extractBotSessionFacts(recentTurns),
    greetingPersona: personaFallbackCtx,
  });
  if (!lastResort.isValid) {
    const fbText = fallbackResponseForPlan(chatTurnPlan, personaFallbackCtx);
    cleanedChunks = splitMultiMessage(fbText, chatTurnPlan.maxBubbles);
    logTemplateFallback({
      fallbackUsed: true,
      fallbackReason: lastResort.reasons.join("; "),
      selectedTemplate: fbText,
      peerId: args.peerId,
      personaName: args.profile.display_name,
      intent: chatTurnPlan.userIntent,
      rawGrokResponse: turnDebug.rawGrokResponse,
      finalResponse: fbText,
    });
    turnDebug.invalidReasons = [
      ...turnDebug.invalidReasons,
      ...lastResort.reasons.map((r) => `last_resort:${r}`),
    ];
  }

  turnDebug.finalCandidate = cleanedChunks.join(" | ");
  turnDebug.finalResponse = cleanedChunks.join("\n");
  logChatTurnDebug(turnDebug);

  if (cleanedChunks.length === 0) {
    const latencyMs = Date.now() - t0;
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: grok.model,
      ok: false,
      error: "Lege reactie na postprocessing",
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return {
      ok: false,
      error: "Lege reactie na postprocessing",
      latencyMs,
      model: grok.model,
    };
  }

  const firstText = cleanedChunks[0]!;
  const fullDraftText =
    cleanedChunks.length <= 1
      ? firstText
      : cleanedChunks.join(`\n${MULTI_MESSAGE_SEPARATOR}\n`);

  if (draftOnly) {
    return {
      ok: true,
      draftOnly: true,
      draftText: fullDraftText,
      finalText: firstText,
      revised,
      latencyMs: Date.now() - t0,
      model: grok.model,
      turnIndex: priorAssistantTurns,
      userSilenceMs,
      additionalChunks: 0,
      nextChunkAt: null,
    };
  }

  // ----- Insert FIRST chunk as the immediate peer message -----
  const { data: insertedPeer, error: peIns } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: args.peerId,
      sender: "peer",
      kind: "text",
      body: firstText,
      owner_user_id: args.ownerUserId,
    })
    .select("*")
    .single();

  const latencyMs = Date.now() - t0;
  if (peIns || !insertedPeer) {
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: grok.model,
      ok: false,
      error: peIns?.message ?? "Insert mislukt",
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return {
      ok: false,
      error: peIns?.message ?? "Insert mislukt",
      latencyMs,
      model: grok.model,
    };
  }

  const assistantRow = insertedPeer as ChatMessageRow;

  void scheduleUnreadEmailNotification(supabase, {
    ownerUserId: args.ownerUserId,
    peerId: args.peerId,
    peerMessageId: assistantRow.id,
  }).catch((e) => {
    console.warn("[generate-peer-reply] unread-email schedule", e);
  });

  // ----- Mark unread user messages as read by the persona -----
  // Anything she just replied to counts as "read"; older user messages
  // without peer_read_at also flip to read (the conversation has moved on).
  // Defensive: tolerate envs where the realism-foundation migration hasn't
  // run yet — a missing peer_read_at column should never crash a reply.
  const nowIso = new Date().toISOString();
  try {
    const { error: readErr } = await supabase
      .from("chat_messages")
      .update({ peer_read_at: nowIso })
      .eq("peer_id", args.peerId)
      .eq("owner_user_id", args.ownerUserId)
      .eq("sender", "me")
      .is("peer_read_at", null);
    if (readErr && /does not exist/i.test(readErr.message)) {
      console.warn("[generate-peer-reply] peer_read_at column missing — apply 20260515110000_chat_realism_foundation.sql");
    } else if (readErr) {
      console.warn("[generate-peer-reply] read-receipt update", readErr.message);
    }
  } catch (e) {
    console.warn("[generate-peer-reply] read-receipt update threw", e);
  }

  // ----- Schedule additional chunks (chunk[1..]) + photos -----
  // Both flow through the same chat_pending_replies queue with different
  // `kind` values. Times are interleaved so each photo lands right after
  // the text chunk it was attached to: text, [photo], next text, etc.
  let additionalChunks = 0;
  let nextChunkAt: string | null = null;
  type PendingInsert = {
    owner_user_id: string;
    peer_id: string;
    user_message_id: string | null;
    parent_user_message_id: string | null;
    scheduled_at: string;
    status: "pending";
    kind: "chunk" | "photo";
    payload_text: string;
  };
  const rowsToInsert: PendingInsert[] = [];

  if (cleanedChunks.length > 1 || photoIntents.length > 0) {
    let cursor = Date.now();

    // Walk the chunks in order; after each chunk (including chunk[0],
    // which is delivered immediately), interleave any photo intents that
    // were attached to that chunk, then schedule the next chunk.
    for (let i = 0; i < cleanedChunks.length; i++) {
      // Photos attached to chunk i — add a small "took the photo" delay.
      const photosForThisChunk = photoIntents.filter((p) => p.afterChunkIndex === i);
      for (const photo of photosForThisChunk) {
        // 4-12s "she just typed, now she's snapping the photo"
        const photoDelay = 4000 + Math.random() * 8000;
        cursor += photoDelay;
        rowsToInsert.push({
          owner_user_id: args.ownerUserId,
          peer_id: args.peerId,
          user_message_id: null,
          parent_user_message_id: triggerId ?? null,
          scheduled_at: new Date(cursor).toISOString(),
          status: "pending",
          kind: "photo",
          payload_text: photo.scene,
        });
      }

      // Next text chunk (skip i=0, that's already inserted as peer message).
      if (i + 1 < cleanedChunks.length) {
        const text = cleanedChunks[i + 1];
        // Burst mode: 5-25s per gap so 4-6 chunks land in 1-2 minutes
        // total — that's the "extreem realistisch" waterfall feel the
        // operator asked for. Regular mode: 2-8s gap with a small
        // text-length bonus, so 2-3 chunks feel naturally spaced out.
        const inter = burstMode
          ? 5000 + Math.random() * 20_000
          : Math.min(8000, 2000 + Math.random() * 3000 + Math.min(text.length * 50, 4000));
        cursor += inter;
        rowsToInsert.push({
          owner_user_id: args.ownerUserId,
          peer_id: args.peerId,
          user_message_id: null,
          parent_user_message_id: triggerId ?? null,
          scheduled_at: new Date(cursor).toISOString(),
          status: "pending",
          kind: "chunk",
          payload_text: text,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: chIns } = await supabase
        .from("chat_pending_replies")
        .insert(rowsToInsert);
      if (!chIns) {
        additionalChunks = rowsToInsert.length;
        nextChunkAt = rowsToInsert[0].scheduled_at;
      } else {
        console.warn(
          "[generate-peer-reply] chunk/photo schedule failed",
          args.peerId,
          chIns.message,
        );
      }
    }
  }

  await supabase.from("ai_chat_turn_logs").insert({
    owner_user_id: args.ownerUserId,
    peer_id: args.peerId,
    user_message_id: triggerId ?? null,
    assistant_message_id: assistantRow.id,
    model: grok.model,
    ok: true,
    error: null,
    latency_ms: latencyMs,
    prompt_version: AI_CHAT_PROMPT_VERSION,
    turn_index: priorAssistantTurns,
    user_silence_ms: userSilenceMs,
    output_chars: cleanedChunks.reduce((acc, c) => acc + c.length, 0),
    had_question_mark: endsWithQuestion(firstText),
    had_emoji: hasEmoji(firstText),
    revised,
  });

  return {
    ok: true,
    assistantRow,
    finalText: firstText,
    revised,
    latencyMs,
    model: grok.model,
    turnIndex: priorAssistantTurns,
    userSilenceMs,
    additionalChunks,
    nextChunkAt,
  };
}

/** Operator-only: run Grok pipeline but never insert user-facing messages. */
export async function generatePeerReplyDraftOnly(
  supabase: Parameters<typeof generatePeerReply>[0],
  args: Parameters<typeof generatePeerReply>[1],
): Promise<
  | { ok: true; draftText: string; model: string; latencyMs: number }
  | { ok: false; error: string }
> {
  const result = await generatePeerReply(supabase, {
    ...args,
    options: { ...args.options, draftOnly: true },
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  if (result.ok && "draftOnly" in result && result.draftOnly) {
    return {
      ok: true,
      draftText: result.draftText,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  }
  return { ok: false, error: "Draft-only mode expected" };
}
