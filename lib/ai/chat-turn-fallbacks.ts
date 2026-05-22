/**
 * Last-resort fallbacks when Grok / coherence / quality gate reject output.
 * Greeting intents use persona-aware pools — never one global "hoi jij".
 */

import type { ChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import {
  pickNonRepeatingPersonaGreeting,
  type PickPersonaGreetingInput,
} from "@/lib/ai/persona-greeting-style";
import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";

function sep(): string {
  return `\n${MULTI_MESSAGE_SEPARATOR}\n`;
}

export type FallbackPersonaContext = PickPersonaGreetingInput;

export function fallbackResponseForPlan(
  plan: ChatTurnPlan,
  personaCtx?: FallbackPersonaContext,
): string {
  switch (plan.userIntent) {
    case "greeting_only":
      if (personaCtx?.peerId) {
        return pickNonRepeatingPersonaGreeting({
          ...personaCtx,
          userMessage: personaCtx.userMessage ?? "hoi",
        });
      }
      return plan.shouldGreet ? "heyy" : "hey";

    case "greeting_plus_how_are_you":
      if (plan.shouldGreet && personaCtx?.peerId) {
        const greet = pickNonRepeatingPersonaGreeting(personaCtx);
        return [greet, "gaat prima eigenlijk", "met jou?"].join(sep());
      }
      if (plan.shouldGreet) {
        return ["heyy", "gaat prima eigenlijk", "met jou?"].join(sep());
      }
      return ["gaat goed hoor", "jij?"].join(sep());

    case "how_are_you": {
      if (plan.knownBotFactsThisSession.just_ate) {
        return plan.canAskBack
          ? ["gaat wel, net ff wat gegeten", "jij?"].join(sep())
          : "gaat wel, net ff wat gegeten";
      }
      return plan.canAskBack
        ? ["gaat wel eigenlijk", "jij?"].join(sep())
        : "gaat goed hoor";
    }

    case "plans_question":
    case "activity_question":
      return ["niet echt veel", "beetje rustig aan vandaag"].join(sep());

    case "flirt":
      return ["haha smooth", "werkt misschien een beetje"].join(sep());

    case "compliment":
      return ["haha dankje", "jij probeert punten te scoren he"].join(sep());

    case "ai_test":
      return ["wow meteen die vraag", "ben gewoon echt hoor, maar nu klink ik juist verdacht"].join(
        sep(),
      );

    case "direct_question":
      return "goeie vraag, ff denken";

    case "smalltalk":
      return "haha fair";

    default:
      if (personaCtx?.peerId && plan.shouldGreet) {
        return pickNonRepeatingPersonaGreeting(personaCtx);
      }
      return plan.shouldGreet ? "heyy" : "gaat wel";
  }
}
