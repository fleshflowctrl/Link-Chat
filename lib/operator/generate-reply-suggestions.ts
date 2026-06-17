import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import {
  generatePeerReplyDraftOnly,
  prepareReplyMemoryContext,
  type PreloadedReplyMemory,
} from "@/lib/ai/generate-peer-reply";
import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";
import { getSavedOperatorSummary } from "@/lib/operator/saved-summary";
import {
  buildOperatorSuggestionContextBlock,
  OPERATOR_SUGGESTION_TONES,
  type OperatorSuggestionTone,
} from "@/lib/operator/operator-suggestion-prompt";
import { pickOperatorSuggestionTone } from "@/lib/operator/pick-operator-tone";

function normalizeSuggestionText(raw: string): string {
  const parts = raw
    .split(MULTI_MESSAGE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  return (parts[0] ?? raw).trim();
}

function suggestionKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeSuggestions(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = suggestionKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function loadThreadMemorySummary(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("chat_ai_thread_memory")
    .select("summary")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();
  const summary = (data as { summary?: string } | null)?.summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : null;
}

type SuggestionBaseInput = {
  profile: ChatProfileRow;
  history: ChatMessageRow[];
  ownerUserId: string;
  peerId: string;
  triggerUserMessageId: string;
  operatorContextBlock: string;
  preloadedMemory: PreloadedReplyMemory;
};

async function generateOneSuggestion(
  supabase: SupabaseClient,
  input: SuggestionBaseInput & {
    tone: OperatorSuggestionTone;
  },
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; error: string }
> {
  const result = await generatePeerReplyDraftOnly(supabase, {
    profile: input.profile,
    history: input.history,
    ownerUserId: input.ownerUserId,
    peerId: input.peerId,
    options: {
      draftOnly: true,
      triggerUserMessageId: input.triggerUserMessageId,
      forceSingleMessage: true,
      forceDraftRevise: true,
      lightDraftRevise: true,
      operatorContextBlock: input.operatorContextBlock,
      operatorSuggestionTone: input.tone,
      skipMemoryPersistence: true,
      preloadedMemory: input.preloadedMemory,
      operatorSuggestMode: true,
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const text = normalizeSuggestionText(result.draftText);
  if (!text) {
    return { ok: false, error: "Lege suggestie" };
  }

  return { ok: true, text, model: result.model };
}

async function buildOperatorContext(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
) {
  const [savedSummary, threadMemorySummary] = await Promise.all([
    getSavedOperatorSummary(supabase, ownerUserId, peerId),
    loadThreadMemorySummary(supabase, ownerUserId, peerId),
  ]);

  return buildOperatorSuggestionContextBlock({
    savedSummary,
    threadMemorySummary,
  });
}

/** Manual operator inbox: 3 tone variants, shared memory + light revise. */
export async function generateOperatorReplySuggestions(
  supabase: SupabaseClient,
  input: {
    profile: ChatProfileRow;
    history: ChatMessageRow[];
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId: string;
  },
): Promise<
  | { ok: true; suggestions: [string, string, string]; model: string }
  | { ok: false; error: string }
> {
  const lastUser = [...input.history]
    .reverse()
    .find((m) => m.sender === "me");
  if (!lastUser) {
    return { ok: false, error: "Geen user-bericht om op te antwoorden" };
  }

  const [operatorContextBlock, preloadedMemory] = await Promise.all([
    buildOperatorContext(supabase, input.ownerUserId, input.peerId),
    prepareReplyMemoryContext(supabase, {
      history: input.history,
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      profile: input.profile,
      persist: true,
    }),
  ]);

  const base = {
    ...input,
    operatorContextBlock,
    preloadedMemory,
  };

  const collected: string[] = [];
  let lastModel = process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";
  const errors: string[] = [];

  const toneResults = await Promise.all(
    OPERATOR_SUGGESTION_TONES.map((tone) =>
      generateOneSuggestion(supabase, { ...base, tone }),
    ),
  );

  for (const result of toneResults) {
    if (result.ok) {
      collected.push(result.text);
      lastModel = result.model;
    } else {
      errors.push(result.error);
    }
  }

  let unique = dedupeSuggestions(collected);

  if (unique.length < 3) {
    for (const tone of OPERATOR_SUGGESTION_TONES) {
      if (unique.length >= 3) break;
      const retry = await generateOneSuggestion(supabase, { ...base, tone });
      if (retry.ok) {
        lastModel = retry.model;
        unique = dedupeSuggestions([...unique, retry.text]);
      } else {
        errors.push(retry.error);
      }
    }
  }

  if (unique.length < 3) {
    return {
      ok: false,
      error:
        errors[0] ??
        `Kon geen 3 unieke suggesties genereren (${unique.length}/3)`,
    };
  }

  return {
    ok: true,
    suggestions: [unique[0]!, unique[1]!, unique[2]!],
    model: lastModel,
  };
}

/** AI auto-reply: tone pick + 1 pipeline (much cheaper than 3× + pick-best). */
export async function generateOperatorAutoReplyDraft(
  supabase: SupabaseClient,
  input: {
    profile: ChatProfileRow;
    history: ChatMessageRow[];
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId: string;
  },
): Promise<
  | { ok: true; text: string; model: string; tone: OperatorSuggestionTone }
  | { ok: false; error: string }
> {
  const lastUser = [...input.history]
    .reverse()
    .find((m) => m.sender === "me");
  if (!lastUser) {
    return { ok: false, error: "Geen user-bericht om op te antwoorden" };
  }

  const [operatorContextBlock, preloadedMemory, tonePick] = await Promise.all([
    buildOperatorContext(supabase, input.ownerUserId, input.peerId),
    prepareReplyMemoryContext(supabase, {
      history: input.history,
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      profile: input.profile,
      persist: true,
    }),
    pickOperatorSuggestionTone({
      profile: input.profile,
      history: input.history,
    }),
  ]);

  const tone = tonePick.ok ? tonePick.tone : "warm";

  const result = await generatePeerReplyDraftOnly(supabase, {
    profile: input.profile,
    history: input.history,
    ownerUserId: input.ownerUserId,
    peerId: input.peerId,
    options: {
      draftOnly: true,
      triggerUserMessageId: input.triggerUserMessageId,
      forceSingleMessage: true,
      forceDraftRevise: true,
      lightDraftRevise: true,
      operatorContextBlock,
      operatorSuggestionTone: tone,
      skipMemoryPersistence: true,
      preloadedMemory,
      operatorSuggestMode: true,
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const text = normalizeSuggestionText(result.draftText);
  if (!text) {
    return { ok: false, error: "Leeg auto-antwoord" };
  }

  return { ok: true, text, model: result.model, tone };
}
