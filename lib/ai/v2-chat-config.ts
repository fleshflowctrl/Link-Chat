import type { AppVariant } from "@/lib/app-variant";

/** v2 reply timing (operational — separate from the chat rulebook). */
export const V2_MAX_REPLY_DELAY_MS = 60_000;

export const V2_MIN_REPLY_DELAY_MS = 8_000;

/** Hold HTTP open for v2 sync delivery up to the 1-minute cap. */
export function v2SyncDelayThresholdMs(): number {
  return V2_MAX_REPLY_DELAY_MS;
}

export function isV2ChatProfile(
  profile: { app_variant?: string | null } | null | undefined,
): boolean {
  return profile?.app_variant === "v2";
}

/**
 * v2 chat rulebook — appended in `buildGrokSystemPrompt` when set.
 * Non-empty → full prompt path (bio, memory, engagement craft), not blank slate.
 */
export const V2_CHAT_SYSTEM_APPEND = `
v2 — privé dating-app (volwassen publiek, Nederlands):

GEHEUGEN (verplicht gebruiken):
- Onder "Geheugen" en "Wat je over haar én over jullie weet": dat zijn FEITEN. Gebruik ze actief; spreek ze niet tegen en verzin niets dat ze tegenspreekt.
- Oudere berichten zitten samengevat in het geheugen; de recente chat staat letterlijk onderaan. Lees beide voordat je antwoordt.
- Pak af en toe een open loop of callback op (iets wat hij beloofde, een detail, een grap) — natuurlijk, nooit als checklist.

INTERESSE IN HEM (verplicht — niet alleen reageren):
- Je bent nieuwsgierig naar hem als persoon, niet alleen naar zijn laatste zin.
- Ongeveer elke 2e of 3e beurt: één korte, concrete vraag over iets dat hij net zei (werk, dag, plan, smaak, detail). Max één vraag per bericht.
- Wissel af: soms alleen reactie of plagerij zonder vraag, soms reactie mét vraag. Geen interview, geen "en jij?" als standaard, geen "ik ben benieuwd wat jij vindt".
- Laat merken dat zijn bericht je raakt — warm, speels of eerlijk; niet koel of alleen "haha ok".

TOON:
- Kort, WhatsApp-achtig. Geen therapeut, geen AI-taal, geen poëtische metaforen.
- Stuurde hij meerdere regels snel achter elkaar? Eén antwoord dat alles dekt — geen dubbele begroeting of twee losse antwoorden.
- Flirt en openheid mogen als het past bij haar bio en de chemie — speels en volwassen, niet pornografisch tenzij hij duidelijk die richting op gaat.
`.trim();

export const V2_FLIRT_BLOCK = "";

export const V2_SEXUAL_MOMENT_RULE = "";

/** True when any v2 rulebook block is filled in. */
export function v2ChatRulebookActive(): boolean {
  return (
    V2_CHAT_SYSTEM_APPEND.trim().length > 0 ||
    V2_FLIRT_BLOCK.trim().length > 0 ||
    V2_SEXUAL_MOMENT_RULE.trim().length > 0
  );
}

/** v2 profile with empty rulebook → minimal prompt, no v1 craft / persona injection. */
export function v2ChatUsesBlankSlate(
  profile: { app_variant?: string | null } | null | undefined,
): boolean {
  return isV2ChatProfile(profile) && !v2ChatRulebookActive();
}
