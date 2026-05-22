/**
 * Session Fact Consistency Guard — bot self-state must stay coherent across
 * recent peer messages (no "net gegeten" then "net aan het lunchen" 1 min later).
 * Runs after conversation-state-guard, before split / delivery.
 */

import type { RecentTurn } from "@/lib/ai/conversation-state-guard";
import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

export type BotActivityKind =
  | "eating"
  | "lunching"
  | "just_ate"
  | "working"
  | "pause"
  | "showering"
  | "in_bed"
  | "just_woke_up"
  | "walking"
  | "outside"
  | "watching_tv"
  | "relaxed"
  | "unknown";

export type BotSessionFacts = {
  bot_current_activity: BotActivityKind;
  bot_recent_activity: BotActivityKind | null;
  bot_location_hint: "thuis" | "werk" | "buiten" | "bed" | "trein" | null;
  bot_mood_hint: "lui" | "druk" | "moe" | "relaxed" | null;
  bot_availability: "pauze" | "bezig" | "vrij" | null;
  /** 0 = most recent peer line in recent window. */
  last_activity_mentioned_at_message_index: number | null;
  /** Raw activity phrases from recent bot lines (for repetition check). */
  recent_activity_phrases: string[];
};

export type SessionFactConsistencyInput = {
  candidateBotResponse: string;
  recentMessages: RecentTurn[];
  currentUserMessage?: string;
  personaName?: string;
  timeContext?: {
    energyState?: string;
    clockText?: string;
  };
};

export type SessionFactConsistencyResult = {
  text: string;
  guardApplied: boolean;
  extractedSessionFacts: BotSessionFacts;
  contradictionDetected: boolean;
  repetitionDetected: boolean;
  invalidReasons: string[];
  originalResponse: string;
};

type ActivityMatch = {
  kind: BotActivityKind;
  phrase: string;
  recent?: boolean;
  location?: BotSessionFacts["bot_location_hint"];
  mood?: BotSessionFacts["bot_mood_hint"];
  availability?: BotSessionFacts["bot_availability"];
};

const ACTIVITY_PATTERNS: Array<{
  re: RegExp;
  kind: BotActivityKind;
  phrase: string;
  recent?: boolean;
  location?: BotSessionFacts["bot_location_hint"];
  mood?: BotSessionFacts["bot_mood_hint"];
  availability?: BotSessionFacts["bot_availability"];
}> = [
  {
    re: /\bnet\s+(?:even\s+)?(?:wat\s+)?gegeten\b|\bnet\s+gegeten\b|\bnet\s+even\s+eten\b/i,
    kind: "just_ate",
    phrase: "net gegeten",
    recent: true,
    availability: "pauze",
  },
  {
    re: /\b(?:aan\s+het|bezig\s+met)\s+lunchen\b|\bnet\s+aan\s+het\s+lunchen\b|\bik\s+lunch\b/i,
    kind: "lunching",
    phrase: "lunchen",
    recent: true,
    availability: "bezig",
  },
  {
    re: /\b(?:aan\s+het|bezig\s+met)\s+eten\b|\b(?:ff\s+)?aan\s+het\s+eten\b/i,
    kind: "eating",
    phrase: "eten",
    availability: "bezig",
  },
  {
    re: /\bnet\s+(?:ff\s+)?pauze\b|\b(?:ff|even)\s+pauze\b|\bin\s+pauze\b/i,
    kind: "pause",
    phrase: "pauze",
    availability: "pauze",
    mood: "relaxed",
  },
  {
    re: /\b(?:lag\s+)?net\s+(?:nog\s+)?half\s+in\s+bed\b|\bnet\s+wakker\b|\bnet\s+opgestaan\b/i,
    kind: "just_woke_up",
    phrase: "net wakker",
    recent: true,
    location: "bed",
    mood: "lui",
  },
  {
    re: /\bin\s+bed\b|\bop\s+bed\b|\b(?:nog\s+)?in\s+bed\s+lig/i,
    kind: "in_bed",
    phrase: "in bed",
    location: "bed",
    mood: "lui",
  },
  {
    re: /\bonderweg\b|\bnaar\s+werk\b|\bnaar\s+kantoor\b|\bin\s+de\s+trein\b/i,
    kind: "walking",
    phrase: "onderweg",
    location: "trein",
    availability: "bezig",
  },
  {
    re: /\b(?:aan\s+het\s+)?werk\b|\bmoet\s+werken\b|\bdruk\s+met\s+werk\b|\bop\s+werk\b/i,
    kind: "working",
    phrase: "werk",
    location: "werk",
    mood: "druk",
    availability: "bezig",
  },
  {
    re: /\bnet\s+gedoucht\b|\b(?:aan\s+het\s+)?douchen\b/i,
    kind: "showering",
    phrase: "douchen",
    recent: true,
  },
  {
    re: /\b(?:tv|netflix|serie)\s+kijk\b|\bkijk\s+(?:even\s+)?tv\b/i,
    kind: "watching_tv",
    phrase: "tv",
    location: "thuis",
    mood: "relaxed",
  },
  {
    re: /\b(?:buiten|wandelen|park)\b/i,
    kind: "outside",
    phrase: "buiten",
    location: "buiten",
  },
  {
    re: /\brelaxed\b|\bchill\b|\brustig\s+aan\b|\blui\b/i,
    kind: "relaxed",
    phrase: "relaxed",
    mood: "relaxed",
    availability: "vrij",
  },
];

const EATING_FAMILY = new Set<BotActivityKind>(["eating", "lunching", "just_ate", "pause"]);

const FOLLOW_UP_OK_RE = [
  /\bnog\s+steeds\b/i,
  /\bbijna\s+klaar\b/i,
  /\bbij\s+te\s+komen\b/i,
  /\bbeetje\s+langzaam\b/i,
  /\bna\s+het\s+eten\b/i,
  /\bna\s+de\s+lunch\b/i,
  /\bnog\s+(?:een\s+)?beetje\b/i,
];

const NEW_ACTIVITY_INTRO_RE = [
  /\b(?:ik\s+ben\s+)?net\s+aan\s+het\s+lunchen\b/i,
  /\b(?:ik\s+ben\s+)?net\s+aan\s+het\s+eten\b/i,
  /\bnet\s+even\s+wat\s+gegeten\b/i,
  /\bnet\s+gegeten\b/i,
  /\b(?:ik\s+ben\s+)?aan\s+het\s+lunchen\b/i,
  /\b(?:ik\s+ben\s+)?aan\s+het\s+eten\b/i,
];

function matchActivities(text: string): ActivityMatch[] {
  const found: ActivityMatch[] = [];
  for (const p of ACTIVITY_PATTERNS) {
    if (p.re.test(text)) {
      found.push({
        kind: p.kind,
        phrase: p.phrase,
        recent: p.recent,
        location: p.location,
        mood: p.mood,
        availability: p.availability,
      });
    }
    p.re.lastIndex = 0;
  }
  return found;
}

function recentPeerBodies(recentMessages: RecentTurn[], limit = 5): string[] {
  const peers: string[] = [];
  for (let i = recentMessages.length - 1; i >= 0 && peers.length < limit; i--) {
    if (recentMessages[i].sender === "peer") {
      peers.push(recentMessages[i].body);
    }
  }
  return peers;
}

export function extractBotSessionFacts(recentMessages: RecentTurn[]): BotSessionFacts {
  const peerBodies = recentPeerBodies(recentMessages, 5);
  const phrases: string[] = [];
  let current: BotActivityKind = "unknown";
  let recentActivity: BotActivityKind | null = null;
  let lastIdx: number | null = null;
  let location: BotSessionFacts["bot_location_hint"] = null;
  let mood: BotSessionFacts["bot_mood_hint"] = null;
  let availability: BotSessionFacts["bot_availability"] = null;

  for (let i = 0; i < peerBodies.length; i++) {
    const matches = matchActivities(peerBodies[i]!);
    for (const m of matches) {
      phrases.push(m.phrase);
      if (lastIdx === null) {
        lastIdx = i;
        current = m.kind;
        if (m.recent) recentActivity = m.kind;
      }
      if (m.location) location = m.location;
      if (m.mood) mood = m.mood;
      if (m.availability) availability = m.availability;
    }
  }

  return {
    bot_current_activity: current,
    bot_recent_activity: recentActivity,
    bot_location_hint: location,
    bot_mood_hint: mood,
    bot_availability: availability,
    last_activity_mentioned_at_message_index: lastIdx,
    recent_activity_phrases: phrases,
  };
}

function isFollowUpActivity(text: string): boolean {
  return FOLLOW_UP_OK_RE.some((re) => re.test(text));
}

function introducesNewActivity(text: string): boolean {
  return NEW_ACTIVITY_INTRO_RE.some((re) => re.test(text));
}

function countEatingMentions(text: string): number {
  const re = /\b(?:lunch|eten|gegeten|pauze|maaltijd)\b/gi;
  return (text.match(re) ?? []).length;
}

export function validateSessionFactConsistency(
  candidate: string,
  session: BotSessionFacts,
  recentMessages: RecentTurn[],
): {
  valid: boolean;
  contradictionDetected: boolean;
  repetitionDetected: boolean;
  invalidReasons: string[];
} {
  const invalidReasons: string[] = [];
  let contradictionDetected = false;
  let repetitionDetected = false;
  const t = candidate.trim();
  if (!t) {
    return {
      valid: false,
      contradictionDetected: false,
      repetitionDetected: false,
      invalidReasons: ["empty"],
    };
  }

  const candidateMatches = matchActivities(t);
  const peerBodies = recentPeerBodies(recentMessages, 5);
  const recentPeerText = peerBodies.join(" ");

  if (isFollowUpActivity(t) && !introducesNewActivity(t)) {
    return {
      valid: true,
      contradictionDetected: false,
      repetitionDetected: false,
      invalidReasons: [],
    };
  }

  const sessionEating =
    EATING_FAMILY.has(session.bot_current_activity) ||
    EATING_FAMILY.has(session.bot_recent_activity ?? "unknown") ||
    /\bgegeten\b/i.test(recentPeerText);

  if (sessionEating && introducesNewActivity(t)) {
    contradictionDetected = true;
    invalidReasons.push("just_ate_vs_new_lunch_intro");
  }

  if (
    (session.bot_current_activity === "just_ate" ||
      session.bot_recent_activity === "just_ate") &&
    candidateMatches.some((m) => m.kind === "lunching" && /net/i.test(t))
  ) {
    contradictionDetected = true;
    invalidReasons.push("just_ate_vs_lunching");
  }

  if (
    (session.bot_current_activity === "in_bed" ||
      session.bot_current_activity === "just_woke_up" ||
      session.bot_location_hint === "bed") &&
    candidateMatches.some((m) => m.kind === "walking" || m.kind === "working")
  ) {
    if (!/\b(?:nu\s+)?(?:eerst|toch|moet)\b/i.test(t)) {
      contradictionDetected = true;
      invalidReasons.push("in_bed_vs_underweg_werk");
    }
  }

  if (
    (session.bot_recent_activity === "just_woke_up" ||
      session.bot_current_activity === "just_woke_up") &&
    candidateMatches.some((m) => m.kind === "working") &&
    /\bdruk\b/i.test(t)
  ) {
    contradictionDetected = true;
    invalidReasons.push("just_woke_vs_busy_work");
  }

  if (session.bot_current_activity === "pause" && introducesNewActivity(t)) {
    const lunchIntro = /\b(?:net\s+)?aan\s+het\s+lunchen\b/i.test(t);
    if (lunchIntro) {
      contradictionDetected = true;
      invalidReasons.push("pause_vs_new_lunch");
    }
  }

  const eatingMentionsRecent = peerBodies
    .slice(0, 3)
    .reduce((n, b) => n + countEatingMentions(b), 0);
  const eatingInCandidate = countEatingMentions(t);
  if (eatingMentionsRecent >= 1 && eatingInCandidate >= 1 && introducesNewActivity(t)) {
    repetitionDetected = true;
    invalidReasons.push("eating_repeated_as_new");
  }

  if (
    session.recent_activity_phrases.filter((p) => /lunch|eten|gegeten|pauze/i.test(p)).length >=
      2 &&
    eatingInCandidate >= 1 &&
    !isFollowUpActivity(t)
  ) {
    repetitionDetected = true;
    invalidReasons.push("activity_phrase_spam");
  }

  return {
    valid: invalidReasons.length === 0,
    contradictionDetected,
    repetitionDetected,
    invalidReasons,
  };
}

function stripConflictingActivityIntros(text: string): string {
  let s = text;
  for (const re of NEW_ACTIVITY_INTRO_RE) {
    s = s.replace(re, " ");
  }
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.!?\s]+/, "")
    .trim();
}

function templateForUserAndSession(
  userMessage: string,
  session: BotSessionFacts,
): string {
  const sep = `\n${MULTI_MESSAGE_SEPARATOR}\n`;
  const u = userMessage.trim().toLowerCase();

  if (EATING_FAMILY.has(session.bot_current_activity) || session.bot_recent_activity === "just_ate") {
    if (/rustig|chill|relaxed|lekker|goed/i.test(u)) {
      return ["klinkt chill", "ik zit hier nog een beetje bij te komen van eten haha"].join(sep);
    }
    return ["relaxed is wel lekker", "ik ben ook niet heel productief vandaag"].join(sep);
  }

  if (session.bot_current_activity === "pause") {
    return ["ja had ik ff nodig", "mijn hoofd stond uit"].join(sep);
  }

  if (
    session.bot_current_activity === "in_bed" ||
    session.bot_current_activity === "just_woke_up"
  ) {
    if (/lui/i.test(u)) {
      return ["niet meteen mij exposen he", "maar ja beetje lui wel"].join(sep);
    }
    return ["haha ja guilty", "nog niet echt in de actiestand"].join(sep);
  }

  if (/rustig|chill|relaxed|lekker|goed/i.test(u)) {
    return ["klinkt chill", "klinkt wel lekker zo"].join(sep);
  }

  return "haha fair";
}

function ruleBasedCorrect(
  candidate: string,
  session: BotSessionFacts,
  userMessage: string,
): string {
  let s = stripConflictingActivityIntros(candidate);
  if (s.length >= 12 && !introducesNewActivity(s)) return s;
  return templateForUserAndSession(userMessage, session);
}

export function isSessionFactConsistencyLlmEnabled(): boolean {
  const raw = process.env.XAI_SESSION_FACT_CONSISTENCY_LLM?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function llmCorrect(
  candidate: string,
  session: BotSessionFacts,
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
          `Herschrijf één antwoord van ${personaName} (Nederlands, dating-app chat).`,
          "Blijf consistent met wat de bot NET over zichzelf zei (eten, bed, werk, pauze).",
          "Introduceer GEEN nieuwe activiteit als die net al genoemd is — reageer op de user.",
          "Geen herhaling van lunch/eten/pauze als nieuw nieuws.",
          "Kort. Optioneel <<<>>> tussen bubbels.",
          `Bot session facts: ${JSON.stringify(session)}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: ["Recent:", recentBlock, "", "Candidate:", candidate, "", "Rewrite:"].join(
          "\n",
        ),
      },
    ],
    { temperature: 0.45, maxOutputTokens: 400 },
  );

  if (!out.ok || !out.text.trim()) return null;
  return out.text.trim();
}

export function logSessionFactConsistencyDev(meta: {
  extractedSessionFacts: BotSessionFacts;
  contradictionDetected: boolean;
  repetitionDetected: boolean;
  invalidReasons: string[];
  originalResponse: string;
  correctedResponse: string;
  guardApplied: boolean;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[session-fact-consistency]",
    JSON.stringify(
      {
        guard_applied: meta.guardApplied,
        contradiction_detected: meta.contradictionDetected,
        repetition_detected: meta.repetitionDetected,
        invalid_reasons: meta.invalidReasons,
        extracted_session_facts: meta.extractedSessionFacts,
        original: meta.originalResponse.slice(0, 500),
        corrected: meta.correctedResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}

export async function applySessionFactConsistencyGuard(
  input: SessionFactConsistencyInput,
): Promise<SessionFactConsistencyResult> {
  const original = input.candidateBotResponse.trim();
  const session = extractBotSessionFacts(input.recentMessages);

  const validation = validateSessionFactConsistency(
    original,
    session,
    input.recentMessages,
  );

  if (validation.valid) {
    logSessionFactConsistencyDev({
      extractedSessionFacts: session,
      contradictionDetected: false,
      repetitionDetected: false,
      invalidReasons: [],
      originalResponse: original,
      correctedResponse: original,
      guardApplied: false,
    });
    return {
      text: original,
      guardApplied: false,
      extractedSessionFacts: session,
      contradictionDetected: false,
      repetitionDetected: false,
      invalidReasons: [],
      originalResponse: original,
    };
  }

  let corrected = ruleBasedCorrect(
    original,
    session,
    input.currentUserMessage ?? "",
  );

  let revalidation = validateSessionFactConsistency(
    corrected,
    session,
    input.recentMessages,
  );

  if (
    !revalidation.valid &&
    isSessionFactConsistencyLlmEnabled() &&
    process.env.XAI_API_KEY?.trim()
  ) {
    try {
      const llm = await llmCorrect(
        corrected,
        session,
        input.recentMessages,
        input.personaName ?? "persona",
      );
      if (llm) {
        corrected = llm;
        revalidation = validateSessionFactConsistency(
          corrected,
          session,
          input.recentMessages,
        );
      }
    } catch {
      /* keep rule-based */
    }
  }

  if (!revalidation.valid) {
    corrected = templateForUserAndSession(
      input.currentUserMessage ?? "",
      session,
    );
  }

  const guardApplied = corrected.trim() !== original;

  logSessionFactConsistencyDev({
    extractedSessionFacts: session,
    contradictionDetected: validation.contradictionDetected,
    repetitionDetected: validation.repetitionDetected,
    invalidReasons: validation.invalidReasons,
    originalResponse: original,
    correctedResponse: corrected.trim(),
    guardApplied,
  });

  return {
    text: corrected.trim(),
    guardApplied,
    extractedSessionFacts: session,
    contradictionDetected: validation.contradictionDetected,
    repetitionDetected: validation.repetitionDetected,
    invalidReasons: validation.invalidReasons,
    originalResponse: original,
  };
}
