/**
 * Contextual follow-up replies (spontaneous, winback, v2_open_followup).
 * User did not answer — the persona sends ONE short bubble that fits the
 * recent dialogue, not a fresh greeting or repeated question.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow } from "@/lib/chat/map-rows";

export type FollowUpKind = "spontaneous" | "winback" | "v2_open_followup";

export type FollowUpContext = {
  lastPeerText: string | null;
  lastUserText: string | null;
  /** Recent peer text lines (newest first) for anti-repeat. */
  recentPeerTexts: string[];
};

const FOLLOW_UP_ANGLES = [
  "korte check-in op precies wat je net zei — geen nieuw onderwerp",
  "speelse stilte: merk op dat hij niet antwoordde, luchtig, geen verwijt",
  "zachte herinnering aan één concreet detail uit je of zijn laatste bericht",
  "loslaten: geen haast, één korte zin die de deur open laat",
  "kleine callback naar iets uit het gesprek — geen interviewvraag",
] as const;

/** Deterministic-ish angle per thread so personas vary but stay stable per peer. */
export function pickFollowUpAngle(peerId: string, kind: FollowUpKind): string {
  let h = 0;
  const seed = `${peerId}:${kind}:${new Date().toISOString().slice(0, 10)}`;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FOLLOW_UP_ANGLES[h % FOLLOW_UP_ANGLES.length];
}

export function buildFollowUpContext(history: ChatMessageRow[]): FollowUpContext {
  let lastPeerText: string | null = null;
  let lastUserText: string | null = null;
  const recentPeerTexts: string[] = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const row = history[i];
    if (row.kind !== "text") continue;
    const body = (row.body ?? "").trim();
    if (!body) continue;

    if (row.sender === "peer") {
      if (!lastPeerText) lastPeerText = body;
      if (recentPeerTexts.length < 4) recentPeerTexts.push(body);
    } else if (row.sender === "me" && !lastUserText) {
      lastUserText = body;
    }
    if (lastPeerText && lastUserText && recentPeerTexts.length >= 4) break;
  }

  return { lastPeerText, lastUserText, recentPeerTexts };
}

/** Greeting / morning clichés to ban when already used in recent peer lines. */
export function followUpExtraBannedPhrases(ctx: FollowUpContext): string[] {
  const banned: string[] = [];
  const combined = ctx.recentPeerTexts.join(" ").toLowerCase();

  const clichés: Array<[RegExp, string]> = [
    [/\bhoi\b/, "hoi"],
    [/\bhey\b/, "hey"],
    [/\bgoedemorgen\b/, "goedemorgen"],
    [/\bgoedenavond\b/, "goedenavond"],
    [/\bgoedemiddag\b/, "goedemiddag"],
    [/\bthee\b/, "thee"],
    [/\bkoffie\b/, "koffie"],
    [/\boke\b.*\bthee\b/, "oke thee"],
    [/\bben je daar\b/, "ben je daar"],
    [/\bwaar ben je\b/, "waar ben je"],
    [/\bhoe was je (weekend|dag|ochtend)\b/, "hoe was je weekend/dag"],
    [/\bofzo\b/, "ofzo"],
    [/\bof\s+zo\b/, "of zo"],
    [/\bpati[eë]nten\b/, "patiënten"],
    [/\bverpleeg/i, "verpleeg"],
    [/\btussen de (diensten|pati)/i, "tussen diensten/patiënten"],
  ];

  for (const [re, label] of clichés) {
    if (re.test(combined)) banned.push(label);
  }

  // Ban repeating the exact last peer opener (first ~40 chars).
  const lp = ctx.lastPeerText?.trim();
  if (lp && lp.length >= 12) {
    const snippet = lp.slice(0, 40).toLowerCase();
    if (snippet.length >= 8) banned.push(snippet);
  }

  return Array.from(new Set(banned)).slice(0, 10);
}

export function followUpPromptBlock(
  kind: FollowUpKind,
  ctx: FollowUpContext,
  angle: string,
): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push("═══ FOLLOW-UP (belangrijk — lees dit vóór je typt) ═══");
  lines.push(
    "Hij heeft NIET geantwoord op wat jij net schreef. Dit is GEEN normaal antwoord op een nieuw bericht van hem — het is één kort nagereepje.",
  );

  if (kind === "v2_open_followup") {
    lines.push(
      "- Situatie: hij opende de chat op jouw laatste bericht maar typte ~5 minuten niets. Eén heel korte zin (max ~12 woorden): callback op jouw laatste tekst, of speels ‘nog daar?’ — geen nieuwe begroeting.",
    );
  } else if (kind === "spontaneous") {
    lines.push(
      "- Situatie: hij is ~30–90 min stil geweest midden in een gesprek. Eén korte zin die terugkomt op iets concreets uit jullie laatste berichten — geen standaard ochtend-/thee-/goedemorgen-gesprek starten.",
    );
  } else {
    lines.push(
      "- Situatie: hij is een dag of meer weg geweest na een echt gesprek. Mag iets warmer (‘hey’ alleen als het nog niet in je recente berichten stond), maar inhoud moet nog steeds uit jullie geschiedenis komen — geen generiek ‘hoe gaat het’ zonder haakje.",
    );
  }

  lines.push("- Eén bubbel alleen. Geen <<<>>> splitsen. Max ~15 woorden, liever korter.");
  lines.push("- GEEN nieuwe begroeting als je recent al hoi/hey/goedemorgen stuurde.");
  lines.push("- GEEN zin die je laatste bericht herhaalt of parafraseert alsof het nieuw is.");
  lines.push("- GEEN standaardinterviewvraag (‘hoe was je weekend’, ‘wat drink je’, ‘en jij?’).");
  lines.push(
    "- GEEN beroep, shift, patiënten of \"tussen het werk door\" — tenzij dat al in jullie laatste berichten stond.",
  );
  lines.push('- GEEN "ofzo" / "of zo" als losse eind-tag.');
  lines.push("- Als jij een vraag stelde: mag zacht openhouden of loslaten — niet dezelfde vraag nog eens.");
  lines.push(`- Stijl-hoek voor deze beurt (volg inhoud uit de chat): ${angle}.`);

  if (ctx.lastPeerText) {
    lines.push(`- Jouw laatste bericht (waar hij niet op reageerde): «${ctx.lastPeerText.slice(0, 280)}»`);
  }
  if (ctx.lastUserText) {
    lines.push(`- Zijn laatste bericht daarvoor (context): «${ctx.lastUserText.slice(0, 280)}»`);
  }

  lines.push(
    "Schrijf NU alleen die ene follow-up zin — Nederlands, WhatsApp-toon, passend bij bovenstaande context.",
  );

  return lines;
}

/** Synthetic user turn so Grok treats this as a follow-up beat, not a new user message. */
/** Cancel other queued follow-ups so only one nag fires per thread. */
export async function supersedeOtherPendingFollowUps(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
  exceptKind?: FollowUpKind,
): Promise<void> {
  const kinds: FollowUpKind[] = ["spontaneous", "winback", "v2_open_followup"];
  const toCancel = exceptKind ? kinds.filter((k) => k !== exceptKind) : kinds;
  if (toCancel.length === 0) return;

  await supabase
    .from("chat_pending_replies")
    .update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .in("kind", toCancel)
    .eq("status", "pending");
}

export function followUpSyntheticUserTurn(kind: FollowUpKind): string {
  const gap =
    kind === "v2_open_followup"
      ? "een paar minuten"
      : kind === "spontaneous"
        ? "een tijdje"
        : "lang";
  return `(Systeem: hij heeft ${gap} niet geantwoord. Stuur nu jouw ene korte follow-up zoals in de instructies — geen begroeting, geen herhaling van je vorige bericht.)`;
}
