/**
 * Conversation State Guard — ensures the final reply follows recent thread state.
 * Runs after dutch-human-realism-rewriter, before split / frontend delivery.
 */

import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";
import type { StructuredFacts } from "@/lib/ai/structured-memory";
import type { ChatMessageRow } from "@/lib/chat/map-rows";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

export type RecentTurn = {
  sender: "user" | "peer";
  body: string;
};

export type RecentContextSummary = {
  today_free: boolean;
  day_already_discussed: boolean;
  user_today_plan: string | null;
  user_flirted_recently: boolean;
  user_complimented_recently: boolean;
  user_asked_ai_question: boolean;
  user_asked_about_her_plans: boolean;
  open_user_questions: string[];
  latest_user_intent:
    | "compliment"
    | "flirt"
    | "ai_test"
    | "day_status"
    | "greeting"
    | "generic";
  /** Joined user lines since last peer reply (this turn). */
  current_turn_user_text: string;
};

export type ConversationStateGuardInput = {
  currentUserMessage: string;
  finalResponse: string;
  recentMessages: RecentTurn[];
  extractedSessionFacts?: StructuredFacts | null;
  bondFormed?: boolean;
  personaName?: string;
};

export type ConversationStateGuardResult = {
  text: string;
  guardApplied: boolean;
  valid: boolean;
  invalidReasons: string[];
  recentContextSummary: RecentContextSummary;
  originalFinalResponse: string;
};

const DAY_QUESTION_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\bwat ga je (?:vandaag )?doen\b/gi, label: "wat ga je doen" },
  { re: /\bwat ga je vandaag\b/gi, label: "wat ga je vandaag" },
  { re: /\bhoe ziet jouw dag eruit\b/gi, label: "hoe ziet jouw dag eruit" },
  { re: /\bhoe ziet je dag eruit\b/gi, label: "hoe ziet je dag eruit" },
  { re: /\bwat staat er op de planning\b/gi, label: "wat staat er op de planning" },
  { re: /\b(?:nog\s+)?plannen vandaag\b/gi, label: "plannen vandaag" },
  { re: /\bwat ga je ermee doen\b/gi, label: "wat ga je ermee doen" },
  { re: /\bhoe is je dag\b/gi, label: "hoe is je dag" },
  { re: /\bhoe gaat (?:jouw|je) dag\b/gi, label: "hoe gaat je dag" },
  { re: /\bwat doe je vandaag\b/gi, label: "wat doe je vandaag" },
  { re: /\bheb je (?:nog )?plannen\b/gi, label: "heb je plannen" },
];

const GENERIC_FALLBACK_QUESTION_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\ben jij\s*\??\s*$/i, label: "en jij?" },
  { re: /\b(?:en\s+)?wat ga jij\b/gi, label: "wat ga jij" },
];

const USER_FREE_RE =
  /\b(?:ik ben|ben|heb|vandaag|is)\s+(?:het\s+)?vrij\b|\bvrij\s+vandaag\b|\b(?:lekker\s+)?vrij\b.*\bvandaag\b/i;
const USER_FLIRT_RE =
  /\b(?:jou|je|jouu)\s+app(?:en)?\b|\bmet jou\b|\bnaar jou\b|\bben je plan\b|\bplan voor vandaag\b/i;
const USER_COMPLIMENT_RE =
  /\bje ziet er goed uit\b|\bziet er (?:goed|lekker)\b|\bmooi\b|\bknap\b|\bcompliment\b/i;
const USER_AI_RE =
  /\b(?:ben je|bent u|jij)\s+(?:echt|een)\s*(?:ai|bot)\b|\bai\s+of\s+echt\b|\bbot\s+ofzo\b|\becht of (?:een )?ai\b/i;
const USER_DAY_STATUS_RE =
  /\b(?:ik ben|ben)\s+vrij\b|\bvrij\s+vandaag\b|\b(?:werk|aan het werk|kantoor|studeren|school)\b/i;
const USER_ASK_HER_PLANS_RE =
  /\b(?:jij|je)\s+nog\s+plannen\b|\bwat ga jij vandaag\b|\bheb jij (?:nog )?plannen\b/i;

/** Last N text turns for guard context. */
export function sliceRecentTurns(
  history: ChatMessageRow[],
  limit = 12,
): RecentTurn[] {
  const out: RecentTurn[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) {
    const row = history[i];
    if (row.kind === "image") continue;
    const body = (row.body ?? "").trim();
    if (!body) continue;
    out.push({
      sender: row.sender === "me" ? "user" : "peer",
      body,
    });
  }
  return out.reverse();
}

function joinUserText(turns: RecentTurn[]): string {
  return turns
    .filter((t) => t.sender === "user")
    .map((t) => t.body)
    .join("\n")
    .trim();
}

function detectLatestIntent(latestUser: string): RecentContextSummary["latest_user_intent"] {
  const u = latestUser.trim().toLowerCase();
  if (!u) return "generic";
  if (USER_AI_RE.test(u)) return "ai_test";
  if (USER_COMPLIMENT_RE.test(u)) return "compliment";
  if (USER_FLIRT_RE.test(u)) return "flirt";
  if (USER_FREE_RE.test(u) || USER_DAY_STATUS_RE.test(u)) return "day_status";
  if (/^(hoi|hey|hallo|ha)\b/i.test(u)) return "greeting";
  return "generic";
}

function extractPlanSnippet(text: string): string | null {
  const m = text.match(
    /\b(?:ik ben|ben|ga|zit|doe|werk|studeren|vrij|appen|thuis)[^.!?\n]{0,60}/i,
  );
  return m ? m[0].trim().slice(0, 80) : null;
}

export function buildRecentContextSummary(
  recentMessages: RecentTurn[],
  currentUserMessage: string,
  extractedSessionFacts?: StructuredFacts | null,
): RecentContextSummary {
  const userLines = recentMessages.filter((t) => t.sender === "user").map((t) => t.body);
  const peerLines = recentMessages.filter((t) => t.sender === "peer").map((t) => t.body);
  const allUser = [...userLines, currentUserMessage].filter(Boolean).join("\n");
  const lastUser =
    currentUserMessage.trim() ||
    userLines[userLines.length - 1] ||
    "";

  let today_free = USER_FREE_RE.test(allUser);
  let day_already_discussed =
    today_free ||
    peerLines.some((p) => DAY_QUESTION_RES.some(({ re }) => re.test(p))) ||
    userLines.some((u) => USER_DAY_STATUS_RE.test(u) && u.length > 12);

  let user_today_plan: string | null = null;
  for (const u of [...userLines, currentUserMessage]) {
    if (USER_FREE_RE.test(u)) {
      today_free = true;
      user_today_plan = extractPlanSnippet(u) ?? "vrij vandaag";
    } else if (USER_DAY_STATUS_RE.test(u)) {
      user_today_plan = extractPlanSnippet(u);
      day_already_discussed = true;
    }
  }

  const facts = extractedSessionFacts?.facts_about_her ?? [];
  for (const f of facts) {
    const fl = f.toLowerCase();
    if (/vrij|vandaag.*vrij|geen werk/.test(fl)) {
      today_free = true;
      day_already_discussed = true;
      if (!user_today_plan) user_today_plan = f.slice(0, 80);
    }
  }

  const user_flirted_recently = USER_FLIRT_RE.test(allUser);
  const user_complimented_recently = USER_COMPLIMENT_RE.test(allUser);
  const user_asked_ai_question = USER_AI_RE.test(allUser);
  const user_asked_about_her_plans = USER_ASK_HER_PLANS_RE.test(allUser);

  const open_user_questions: string[] = [];
  if (user_asked_ai_question) open_user_questions.push("ai_or_bot");
  if (user_asked_about_her_plans) open_user_questions.push("her_plans_today");

  return {
    today_free,
    day_already_discussed,
    user_today_plan,
    user_flirted_recently,
    user_complimented_recently,
    user_asked_ai_question,
    user_asked_about_her_plans,
    open_user_questions,
    latest_user_intent: detectLatestIntent(lastUser),
    current_turn_user_text: currentUserMessage.trim() || lastUser,
  };
}

function responseMentionsAi(text: string): boolean {
  return /\b(?:ai|bot|echt|nep|robot|taalmodel)\b/i.test(text);
}

function responseAcknowledgesFlirt(text: string): boolean {
  return /\b(?:plan|jou|je|app|smooth|flirt|punten|compliment|leuk|grappig)\b/i.test(text);
}

export function validateFinalResponse(
  response: string,
  summary: RecentContextSummary,
  _currentUserMessage: string,
): { valid: boolean; invalidReasons: string[] } {
  const invalidReasons: string[] = [];
  const t = response.trim();
  if (!t) {
    return { valid: false, invalidReasons: ["empty_response"] };
  }

  const banDayQuestions =
    summary.today_free ||
    summary.day_already_discussed ||
    !!summary.user_today_plan;

  if (banDayQuestions) {
    for (const { re, label } of DAY_QUESTION_RES) {
      if (re.test(t)) {
        invalidReasons.push(`day_question_already_answered:${label}`);
      }
      re.lastIndex = 0;
    }
  }

  if (summary.user_flirted_recently && summary.latest_user_intent === "compliment") {
    for (const { re, label } of DAY_QUESTION_RES) {
      if (re.test(t)) {
        invalidReasons.push(`ignored_compliment_for_day_question:${label}`);
      }
      re.lastIndex = 0;
    }
  }

  if (
    summary.latest_user_intent === "compliment" &&
    !responseAcknowledgesFlirt(t) &&
    DAY_QUESTION_RES.some(({ re }) => re.test(t))
  ) {
    invalidReasons.push("missed_compliment");
  }

  if (summary.latest_user_intent === "flirt" && !responseAcknowledgesFlirt(t)) {
    if (GENERIC_FALLBACK_QUESTION_RES.some(({ re }) => re.test(t))) {
      invalidReasons.push("generic_instead_of_flirt");
    }
    if (DAY_QUESTION_RES.some(({ re }) => re.test(t))) {
      invalidReasons.push("day_question_instead_of_flirt");
    }
  }

  if (summary.user_asked_ai_question && !responseMentionsAi(t)) {
    invalidReasons.push("missed_ai_question");
  }

  if (banDayQuestions) {
    for (const { re, label } of GENERIC_FALLBACK_QUESTION_RES) {
      if (re.test(t)) {
        invalidReasons.push(`generic_en_jij:${label}`);
      }
      re.lastIndex = 0;
    }
  }

  return { valid: invalidReasons.length === 0, invalidReasons };
}

function stripBannedPhrases(text: string, summary: RecentContextSummary): string {
  let s = text;
  const banDay =
    summary.today_free ||
    summary.day_already_discussed ||
    !!summary.user_today_plan;

  if (banDay) {
    for (const { re } of DAY_QUESTION_RES) {
      s = s.replace(re, " ");
      re.lastIndex = 0;
    }
    for (const { re } of GENERIC_FALLBACK_QUESTION_RES) {
      s = s.replace(re, " ");
      re.lastIndex = 0;
    }
  }

  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function templateCorrection(summary: RecentContextSummary): string {
  const sep = `\n${MULTI_MESSAGE_SEPARATOR}\n`;

  if (summary.user_asked_about_her_plans && summary.user_asked_ai_question) {
    return ["lunch nu", "en wow meteen die ai-test 😭", "ik ben gewoon irritant echt"].join(sep);
  }

  if (summary.latest_user_intent === "ai_test" || summary.user_asked_ai_question) {
    return ["haha ai-test meteen", "nee joh gewoon irritant hier"].join(sep);
  }

  if (summary.latest_user_intent === "compliment") {
    return ["haha smooth hoor", "maar oke dat compliment helpt wel"].join(sep);
  }

  if (summary.latest_user_intent === "flirt" || summary.user_flirted_recently) {
    return ["hahaha oké dan ben ik je plan blijkbaar", "maar ik tel niet te snel winst"].join(sep);
  }

  if (summary.today_free) {
    return ["haha lekker vrij dan", "dan mag je me storen hoor"].join(sep);
  }

  if (summary.user_asked_about_her_plans) {
    return ["ff lunch nog", "daarna weer chaos waarschijnlijk"].join(sep);
  }

  return "haha fair";
}

function mergeAiAckIfNeeded(text: string, summary: RecentContextSummary): string {
  if (!summary.user_asked_ai_question || responseMentionsAi(text)) return text;
  const sep = `\n${MULTI_MESSAGE_SEPARATOR}\n`;
  if (text.includes(MULTI_MESSAGE_SEPARATOR)) {
    const parts = text.split(/\n*\s*<<<>>>\s*\n*/);
    if (parts.length >= 2) {
      parts.splice(1, 0, "en wow meteen die ai-test 😭");
      return parts.join(sep);
    }
  }
  return `${text.trim()}${sep}en wow meteen die ai-test 😭`;
}

function ruleBasedCorrect(
  response: string,
  summary: RecentContextSummary,
): string {
  let s = stripBannedPhrases(response, summary);
  s = mergeAiAckIfNeeded(s, summary);

  const stillInvalid = validateFinalResponse(s, summary, summary.current_turn_user_text);
  if (stillInvalid.valid && s.length >= 3) return s;

  if (s.length < 8 || stillInvalid.invalidReasons.some((r) => r.startsWith("day_question"))) {
    return templateCorrection(summary);
  }

  return s.trim() || templateCorrection(summary);
}

export function isConversationStateGuardLlmEnabled(): boolean {
  const raw = process.env.XAI_CONVERSATION_STATE_GUARD_LLM?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function llmCorrectResponse(
  response: string,
  summary: RecentContextSummary,
  recentMessages: RecentTurn[],
  personaName: string,
): Promise<string | null> {
  const recentBlock = recentMessages
    .map((t) => `${t.sender === "user" ? "User" : "Bot"}: ${t.body}`)
    .join("\n");

  const out = await grokResponsesComplete(
    [
      {
        role: "system",
        content: [
          `Je herschrijft één dating-app antwoord van ${personaName} in het Nederlands.`,
          "Rewrite zodat het DIRECT aansluit op de recente chat.",
          "Stel GEEN vragen die al beantwoord zijn (dag/plannen als user al vrij zei).",
          "Reageer eerst op het laatste user-bericht.",
          "Kort, WhatsApp-toon. Geen assistent-taal.",
          "Output alleen de herschreven tekst. Optioneel 2-3 bubbels met <<<>>> op eigen regel.",
          "",
          `Context: ${JSON.stringify(summary)}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "Recente chat:",
          recentBlock,
          "",
          "Candidate reply:",
          response,
          "",
          "Rewrite:",
        ].join("\n"),
      },
    ],
    { temperature: 0.5, maxOutputTokens: 400 },
  );

  if (!out.ok || !out.text.trim()) return null;
  return out.text.trim();
}

export function logConversationStateGuardDev(meta: {
  recentContextSummary: RecentContextSummary;
  invalidReasons: string[];
  originalFinalResponse: string;
  correctedFinalResponse: string;
  guardApplied: boolean;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[conversation-state-guard]",
    JSON.stringify(
      {
        guard_applied: meta.guardApplied,
        invalid_reasons: meta.invalidReasons,
        recent_context_summary: meta.recentContextSummary,
        original: meta.originalFinalResponse.slice(0, 500),
        corrected: meta.correctedFinalResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}

/**
 * Validate and correct final Grok output before split / delivery.
 */
export async function applyConversationStateGuard(
  input: ConversationStateGuardInput,
): Promise<ConversationStateGuardResult> {
  const original = input.finalResponse.trim();
  const summary = buildRecentContextSummary(
    input.recentMessages,
    input.currentUserMessage,
    input.extractedSessionFacts,
  );

  const validation = validateFinalResponse(
    original,
    summary,
    input.currentUserMessage,
  );

  if (validation.valid) {
    const result: ConversationStateGuardResult = {
      text: original,
      guardApplied: false,
      valid: true,
      invalidReasons: [],
      recentContextSummary: summary,
      originalFinalResponse: original,
    };
    logConversationStateGuardDev({
      recentContextSummary: summary,
      invalidReasons: [],
      originalFinalResponse: original,
      correctedFinalResponse: original,
      guardApplied: false,
    });
    return result;
  }

  let corrected = ruleBasedCorrect(original, summary);
  let revalidation = validateFinalResponse(
    corrected,
    summary,
    input.currentUserMessage,
  );

  if (
    !revalidation.valid &&
    isConversationStateGuardLlmEnabled() &&
    process.env.XAI_API_KEY?.trim()
  ) {
    try {
      const llm = await llmCorrectResponse(
        corrected,
        summary,
        input.recentMessages,
        input.personaName ?? "persona",
      );
      if (llm) {
        corrected = llm;
        revalidation = validateFinalResponse(
          corrected,
          summary,
          input.currentUserMessage,
        );
      }
    } catch {
      /* keep rule-based */
    }
  }

  if (!revalidation.valid) {
    corrected = templateCorrection(summary);
  }

  const result: ConversationStateGuardResult = {
    text: corrected.trim(),
    guardApplied: corrected.trim() !== original,
    valid: revalidation.valid,
    invalidReasons: validation.invalidReasons,
    recentContextSummary: summary,
    originalFinalResponse: original,
  };

  logConversationStateGuardDev({
    recentContextSummary: summary,
    invalidReasons: validation.invalidReasons,
    originalFinalResponse: original,
    correctedFinalResponse: result.text,
    guardApplied: result.guardApplied,
  });

  return result;
}
