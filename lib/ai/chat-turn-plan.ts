/**
 * Central turn planner — intent + constraints before Grok writes anything.
 */

import type { RecentTurn } from "@/lib/ai/conversation-state-guard";
import {
  normalizeUserMessageIntent,
  type NormalizedUserIntent,
} from "@/lib/ai/message-intent-normalizer";
import {
  extractBotSessionFacts,
  type BotSessionFacts,
} from "@/lib/ai/session-fact-consistency-guard";
import type { StructuredFacts } from "@/lib/ai/structured-memory";
import type { PersonaSelfFacts } from "@/lib/ai/persona-self-memory";

export type ChatTurnUserIntent =
  | "greeting_only"
  | "greeting_plus_how_are_you"
  | "how_are_you"
  | "plans_question"
  | "activity_question"
  | "flirt"
  | "compliment"
  | "ai_test"
  | "direct_question"
  | "smalltalk"
  | "unknown";

export type ChatTurnPlan = {
  userIntent: ChatTurnUserIntent;
  mustAnswer: string[];
  shouldNotAsk: string[];
  allowedMoves: string[];
  bannedMoves: string[];
  knownUserFactsThisSession: Record<string, string | boolean>;
  knownBotFactsThisSession: Record<string, string | boolean>;
  maxBubbles: number;
  maxTotalChars: number;
  shouldGreet: boolean;
  canAskBack: boolean;
  canIntroduceBotActivity: boolean;
  needsDirectAnswerFirst: boolean;
  /** Operator inbox / AI auto — warmer length + optional follow-up question */
  operatorSuggestMode?: boolean;
  shouldEncourageQuestion?: boolean;
  /** Internal — drives prompt + fallbacks */
  normalizedIntent: NormalizedUserIntent;
};

const DAY_QUESTION_PHRASES = [
  "hoe ziet je dag eruit",
  "hoe ziet jouw dag eruit",
  "hoe gaat jouw dag",
  "wat ga je vandaag doen",
  "wat ga je doen vandaag",
  "plannen vandaag",
  "wat staat er op de planning",
  "hoe is jouw dag tot nu toe",
];

/** User asked hoe gaat het — bot must not mirror with a long opener question */
const ECHO_HOW_ARE_YOU_PHRASES = [
  "hoe gaat je op deze",
  "hoe gaat je op",
  "hoe gaat je hier",
  "hoe gaat je vandaag",
  "hoe gaat je deze",
];

const USER_FREE_RE =
  /\b(?:ik ben|ben)\s+vrij\b|\bvrij\s+vandaag\b|\bheb\s+vrij\b/i;
const USER_FLIRT_RE =
  /\b(?:jou|je)\s+app(?:en)?\b|\bmet jou\b|\bben je plan\b/i;
const USER_ACTIVITY_ASK_RE =
  /\b(?:wat\s+doe\s+je|waar\s+ben\s+je|bezig\s+met)\b/i;
const USER_PLANS_ASK_RE = /\b(?:nog\s+)?plannen\b|\bheb jij plannen\b/i;
const USER_AI_RE =
  /\b(?:ben je|jij)\s+(?:echt|een)\s*(?:ai|bot)\b|\bai\s+of\s+echt\b/i;
const USER_COMPLIMENT_RE = /\bje ziet er|ziet er (?:goed|lekker)\b/i;
const DIRECT_Q_RE = /\?/;

function mapNormalizedToTurnIntent(n: NormalizedUserIntent): ChatTurnUserIntent {
  switch (n.combinedUserIntent) {
    case "greeting_only":
      return "greeting_only";
    case "greeting_plus_how_are_you":
      return "greeting_plus_how_are_you";
    case "how_are_you":
      return "how_are_you";
    case "plans":
      return "plans_question";
    case "flirt":
      return "flirt";
    case "compliment":
      return "compliment";
    case "ai_test":
      return "ai_test";
    default:
      return "smalltalk";
  }
}

function extractUserFacts(
  userText: string,
  structured?: StructuredFacts | null,
): Record<string, string | boolean> {
  const facts: Record<string, string | boolean> = {};
  if (USER_FREE_RE.test(userText)) {
    facts.today_free = true;
    facts.user_today_plan = "vrij vandaag";
  }
  if (USER_FLIRT_RE.test(userText)) facts.user_flirted = true;
  if (USER_AI_RE.test(userText)) facts.user_asked_ai = true;
  if (USER_COMPLIMENT_RE.test(userText)) facts.user_complimented = true;

  for (const f of structured?.facts_about_her ?? []) {
    const fl = f.toLowerCase();
    if (/vrij|vandaag/.test(fl)) facts.today_free = true;
  }
  return facts;
}

function botFactsRecord(session: BotSessionFacts): Record<string, string | boolean> {
  return {
    bot_current_activity: session.bot_current_activity,
    bot_recent_activity: session.bot_recent_activity ?? "",
    bot_location_hint: session.bot_location_hint ?? "",
    bot_mood_hint: session.bot_mood_hint ?? "",
    bot_availability: session.bot_availability ?? "",
    just_ate:
      session.bot_current_activity === "just_ate" ||
      session.bot_recent_activity === "just_ate",
    in_bed:
      session.bot_current_activity === "in_bed" ||
      session.bot_current_activity === "just_woke_up",
  };
}

export type BuildChatTurnPlanInput = {
  currentUserMessage: string;
  userBurstLines: string[];
  userBurstTimestamps?: number[];
  recentMessages: RecentTurn[];
  structuredFacts?: StructuredFacts | null;
  personaSelfFacts?: PersonaSelfFacts | null;
  bondFormed?: boolean;
  userFlirtLevel?: "low" | "medium" | "high" | "explicit";
  isFollowUp?: boolean;
  /** Operator suggest / AI auto — longer, warmer replies with smart questions */
  operatorSuggestMode?: boolean;
};

const USER_SHORT_DISMISSIVE_RE =
  /^(?:ok(?:é|e|ay)?|ja|jaa|haha|hehe|lol|hm+|mm+)\.?$/i;

export function buildChatTurnPlan(input: BuildChatTurnPlanInput): ChatTurnPlan {
  const userText = input.currentUserMessage.trim();
  const allUser = [
    ...input.userBurstLines,
    userText,
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedIntent = normalizeUserMessageIntent({
    recentMessages: input.recentMessages,
    currentUserMessage: userText,
    userBurstLines: input.userBurstLines,
    userBurstTimestamps: input.userBurstTimestamps,
    recentPeerBodies: input.recentMessages
      .filter((t) => t.sender === "peer")
      .slice(-3)
      .map((t) => t.body),
    currentTimestamp: Date.now(),
  });

  const sessionBot = extractBotSessionFacts(input.recentMessages);
  const knownUser = extractUserFacts(allUser, input.structuredFacts);
  const knownBot = botFactsRecord(sessionBot);

  let userIntent = mapNormalizedToTurnIntent(normalizedIntent);

  if (USER_ACTIVITY_ASK_RE.test(allUser)) userIntent = "activity_question";
  else if (USER_PLANS_ASK_RE.test(allUser) && userIntent === "smalltalk") {
    userIntent = "plans_question";
  } else if (
    USER_AI_RE.test(allUser) &&
    userIntent !== "greeting_only" &&
    userIntent !== "greeting_plus_how_are_you"
  ) {
    userIntent = "ai_test";
  } else if (
    DIRECT_Q_RE.test(allUser) &&
    userIntent === "smalltalk" &&
    !normalizedIntent.userAskedHowAreYou
  ) {
    userIntent = "direct_question";
  }

  const shouldNotAsk = [...DAY_QUESTION_PHRASES];
  const bannedMoves: string[] = [
    "mid-thought fragment",
    "random activity without context",
    "double greeting",
    "broken typo words",
  ];
  const allowedMoves: string[] = [];
  const mustAnswer: string[] = [];

  if (knownUser.today_free) {
    shouldNotAsk.push(
      "wat ga je vandaag doen",
      "hoe ziet je dag eruit",
      "plannen vandaag",
    );
    bannedMoves.push("ask what user does today");
  }

  if (knownUser.user_flirted) {
    shouldNotAsk.push("wat ga je vandaag doen", "hoe ziet je dag eruit");
    bannedMoves.push("reset to smalltalk", "generic day question");
  }

  if (knownBot.just_ate) {
    bannedMoves.push("say currently lunching as new info", "repeat eating as new topic");
  }
  if (knownBot.in_bed) {
    bannedMoves.push("say onderweg or at work without transition");
  }

  let maxBubbles = 2;
  let maxTotalChars = 120;
  let shouldGreet = normalizedIntent.shouldBotGreet;
  let canAskBack = normalizedIntent.shouldBotAskBack;
  let canIntroduceBotActivity = false;
  let needsDirectAnswerFirst = true;

  switch (userIntent) {
    case "greeting_only":
      mustAnswer.push("greet casually");
      allowedMoves.push("short greeting", "light opener");
      bannedMoves.push("how_are_you answer", "random activity");
      maxBubbles = 1;
      maxTotalChars = 45;
      canAskBack = true;
      break;

    case "greeting_plus_how_are_you":
      mustAnswer.push("greet once max", "answer how bot is doing");
      allowedMoves.push("short answer", "optional met jou");
      bannedMoves.push(
        "double greeting",
        "generic day question",
        "echo hoe gaat je question",
      );
      shouldNotAsk.push(...ECHO_HOW_ARE_YOU_PHRASES);
      maxBubbles = 3;
      maxTotalChars = 100;
      canIntroduceBotActivity = knownBot.bot_current_activity !== "unknown";
      break;

    case "how_are_you":
      mustAnswer.push("answer how bot is");
      allowedMoves.push("short mood", "optional jij");
      maxBubbles = 2;
      maxTotalChars = 80;
      break;

    case "flirt":
      mustAnswer.push("react to flirt first");
      allowedMoves.push("tease", "light flirt", "callback");
      bannedMoves.push("reset to smalltalk");
      maxBubbles = 2;
      maxTotalChars = 120;
      break;

    case "compliment":
      mustAnswer.push("acknowledge compliment");
      allowedMoves.push("tease", "warm short");
      maxBubbles = 2;
      maxTotalChars = 90;
      break;

    case "ai_test":
      mustAnswer.push("acknowledge ai question naturally");
      allowedMoves.push("playful deflect", "short real-person vibe");
      maxBubbles = 3;
      maxTotalChars = 110;
      break;

    case "activity_question":
    case "plans_question":
      mustAnswer.push("answer what bot is doing or plans");
      canIntroduceBotActivity = true;
      allowedMoves.push("short honest answer");
      maxBubbles = 2;
      maxTotalChars = 100;
      break;

    case "direct_question":
      mustAnswer.push("answer user question first");
      maxBubbles = 2;
      maxTotalChars = 100;
      break;

    default:
      mustAnswer.push("react to latest user line");
      allowedMoves.push("short casual reply");
      maxBubbles = 2;
      maxTotalChars = 100;
  }

  if (input.isFollowUp) {
    maxBubbles = 1;
    maxTotalChars = 80;
    shouldGreet = false;
    canIntroduceBotActivity = false;
  }

  if (
    !input.operatorSuggestMode &&
    allUser.length < 25 &&
    userIntent !== "greeting_plus_how_are_you"
  ) {
    maxTotalChars = Math.min(maxTotalChars, 70);
  }

  let operatorSuggestMode = Boolean(input.operatorSuggestMode);
  let shouldEncourageQuestion = false;

  if (operatorSuggestMode) {
    maxTotalChars = Math.max(maxTotalChars + 50, 130);
    if (userIntent === "greeting_only") {
      maxTotalChars = Math.max(maxTotalChars, 90);
    } else if (allUser.length < 25) {
      maxTotalChars = Math.max(maxTotalChars, 110);
    }

    const recentPeerBodies = input.recentMessages
      .filter((t) => t.sender === "peer")
      .slice(-3)
      .map((t) => t.body ?? "");
    const peerQuestionsRecent = recentPeerBodies.filter((b) => b.includes("?")).length;
    const userShortDismissive = USER_SHORT_DISMISSIVE_RE.test(allUser.trim());
    const userSubstantive = allUser.length >= 25;

    shouldEncourageQuestion =
      !userShortDismissive &&
      peerQuestionsRecent < 2 &&
      (userSubstantive ||
        userIntent === "flirt" ||
        userIntent === "compliment" ||
        userIntent === "direct_question" ||
        userIntent === "activity_question" ||
        userIntent === "plans_question" ||
        userIntent === "greeting_plus_how_are_you" ||
        userIntent === "how_are_you");

    if (shouldEncourageQuestion) {
      canAskBack = true;
      allowedMoves.push(
        "1-3 warme zinnen",
        "concrete vraag over iets uit zijn bericht",
      );
    } else {
      allowedMoves.push("1-3 warme zinnen, betrokken — niet kil");
    }
  }

  return {
    userIntent,
    mustAnswer,
    shouldNotAsk,
    allowedMoves,
    bannedMoves,
    knownUserFactsThisSession: knownUser,
    knownBotFactsThisSession: knownBot,
    maxBubbles,
    maxTotalChars,
    shouldGreet,
    canAskBack,
    canIntroduceBotActivity,
    needsDirectAnswerFirst,
    operatorSuggestMode,
    shouldEncourageQuestion,
    normalizedIntent,
  };
}

/** Compact Dutch block injected near top of system prompt. */
export function chatTurnPlanPromptLines(plan: ChatTurnPlan): string[] {
  const userFacts = Object.entries(plan.knownUserFactsThisSession)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("; ");
  const botFacts = Object.entries(plan.knownBotFactsThisSession)
    .filter(([, v]) => v && v !== "unknown" && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("; ");

  return [
    "GESPREKSPLAN VOOR DIT ANTWOORD (verplicht volgen — logica vóór stijl):",
    `- Intent: ${plan.userIntent}`,
    `- Eerst beantwoorden: ${plan.mustAnswer.join("; ")}`,
    `- Niet vragen/zeggen: ${plan.shouldNotAsk.join("; ") || "(geen extra verboden vragen)"}`,
    `- Toegestaan: ${plan.allowedMoves.join("; ")}`,
    `- Verboden: ${plan.bannedMoves.join("; ")}`,
    userFacts ? `- Bekende feiten over hem: ${userFacts}` : "",
    botFacts ? `- Wat jij net over jezelf zei / doet: ${botFacts}` : "",
    `- Max lengte: ~${plan.maxTotalChars} tekens, max ${plan.maxBubbles} bubbel(s) (gebruik <<<>>> tussen bubbels)`,
    `- Groeten: ${plan.shouldGreet ? "ja, max één korte begroeting" : "nee, niet opnieuw groeten"}`,
    `- Terugvragen: ${
      plan.shouldEncourageQuestion
        ? "ja — één concrete vraag over iets uit zijn bericht als dat natuurlijk past (geen standaardinterview)"
        : plan.canAskBack
          ? "mag, max één korte vraag"
          : "liever niet"
    }`,
    `- Nieuwe activiteit over jezelf: ${plan.canIntroduceBotActivity ? "alleen kort en consistent met wat je al zei" : "nee, tenzij hij vraagt wat je doet"}`,
    plan.operatorSuggestMode
      ? "- Stijl: 1-3 zinnen Nederlands, warm betrokken — niet telegrafisch of ongeïnteresseerd. Geen AI-toon, weinig emoji."
      : "- Stijl komt daarna: kort Nederlands, casual, geen AI-toon, weinig emoji, geen '...' spam.",
  ].filter(Boolean);
}
