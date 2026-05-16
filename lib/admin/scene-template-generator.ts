/**
 * Grok-driven scene-template generator.
 *
 * Given a target count, this module:
 *   1. Samples a handful of high-quality active templates from the DB
 *      as few-shot exemplars.
 *   2. Loads the last 20 rejection reasons + tags as negative feedback.
 *   3. Asks Grok for a JSON array of exactly `count` new templates
 *      following the SceneTemplate schema.
 *   4. Parses, validates, dedupes, and returns them ready for insert.
 *
 * The schema lives in lib/images/scene-templates.ts → SceneTemplate.
 * We deliberately do NOT generate any of the diffusion-prompt tail
 * (face anchors, age anchors, etc.) — those live in
 * lib/images/persona-photo-prompt.ts. Templates are *just* the seven
 * scene/camera/backdrop/lighting/capture/outfit/pose fields plus the
 * kind tag.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import type { SceneTemplate } from "@/lib/images/scene-templates";
import { stripBlurPhrases } from "@/lib/images/persona-photo-prompt";
import {
  loadRecentRejections,
  sampleActiveTemplatesForFewShot,
  type RejectionTag,
} from "@/lib/admin/scene-templates-store";

const KIND_VALUES = ["avatar", "gallery", "mixed"] as const;

const SYSTEM_PROMPT = `Je genereert scene-templates voor een Nederlandse AI-dating-app. Elke template wordt gebruikt om EEN foto van een persona te renderen via een diffusion-model.

Output STRIKT geldige JSON, niets anders. Geen markdown-fences, geen toelichting, geen voor- of natekst — alleen één JSON-object met de vorm:

{
  "templates": [
    { "scene": "...", "camera": "...", "backdrop": "...", "lighting": "...", "capture": "...", "outfit": "...", "pose": "...", "kind": "gallery" },
    ...
  ]
}

Velden uitgelegd:
- scene (Nederlands of mix NL/EN, 1 zin): WAT ze aan het doen is en WAAR. Concrete activiteit, geen abstracte sfeer. Bijv: "kleedkamer mirror selfie voordat ze de deur uitgaat", "vakantiekiekje voor de Belém-toren in Lissabon", "snelle stadsparkselfie op een doordeweekse middag".
- camera (Engels): camera-afstand/hoek/framing. Concrete diffusion-tokens. Bijv: "regular phone snapshot full body from a few meters away, slight tilt", "phone selfie close-up, head and shoulders fill the frame", "full body mirror selfie with phone clearly visible at face height".
- backdrop (Engels): zichtbare achtergrond. STRIKTE eisen om het diffusion-model te dwingen alles scherp te renderen i.p.v. portrait-mode bokeh toe te passen:
    * MINIMAAL 3 concreet benoemde objecten met zichtbaar detail (kleur + vorm + herkenbaar kenmerk). Niet "people walking" maar "two women in red and beige raincoats, one man in a dark blue puffer jacket holding a black umbrella".
    * Alles binnen ~3-5 meter van het onderwerp. Geen "extending into the distance", geen "stretching far behind", geen "in the background somewhere".
    * GEEN afstand/sfeer-woorden: NOOIT "distant", "in the distance", "far away", "silhouettes", "figures", "shapes", "vague", "atmospheric", "softly lit", "hazy", "misty", "abstract", "a sense of", "hints of", "barely visible", "fading into" — die woorden zijn directe instructies voor het model om te blurren.
    * Sluit ALTIJD af met een expliciet scherpte-token zoals "every object clearly visible and sharp", "all elements rendered in full detail", "background fully detailed and crisp".
    Bijv: "narrow old European street at night, warm yellow streetlight glow, dark stone wall with graffiti tags two meters left, a closed wooden door with iron hinges three meters back, every brick and detail clearly visible and sharp".
- lighting (Engels): licht-mood. Concrete licht-tokens, geen "natural lighting". Bijv: "harsh streetlight from behind/side, strong lens flare cutting across the face", "soft warm window daylight, glowy on the cheek", "bright sunny midday, sharp clear blue tones".
- capture (Engels): apparaat-feel. MOET expliciet "iPhone main wide-angle camera" / "phone wide-angle 24mm" / "deep focus" / "everything sharp" tokens bevatten — anders defaultet het diffusion-model naar portrait-mode bokeh. Bijv: "iPhone main wide-angle camera at f/8, full deep focus across the frame, unedited, visible streetlight lens flare", "iPhone wide-angle main camera, every detail in the background still sharp, unedited mirror selfie", "iPhone main camera wide-angle, deep focus snapshot taken by a friend, unedited". NOOIT "85mm portrait lens", "DSLR", "telephoto", "shot on Leica", "soft glow background", "creamy background" of welk synoniem voor shallow depth of field dan ook.
- outfit (Engels): exacte kleding voor DEZE foto. Geen "casual outfit" — concreet: kleur + type + accessoires + haar. Bijv: "sleeveless burgundy or wine-red top, regular dark jeans, simple silver wristwatch, hair loose past shoulders".
- pose (Engels): lichaamshouding voor DEZE foto. Concreet: handen, gezichtsrichting, smile/no smile, ogen op camera ja/nee. Bijv: "standing relaxed on the sidewalk, arms loose at her sides, neutral half-smile, looking flatly at the camera not posing".
- kind: één van "avatar" | "gallery" | "mixed".
    - "avatar" = face-forward, herkenbaar gezicht (selfie close-up, head-and-shoulders, lachend recht in de camera). Gebruikt voor profielfoto.
    - "gallery" = full-body / activity / wider shot. Gebruikt voor extra foto's op het profiel.
    - "mixed" = kan beide. Gebruik spaarzaam (max 10%).

HARDE REGELS:
- ALLE personas in deze app zijn vrouwen tussen 18 en 99 met middellang tot lang haar. Geen mannen, geen kort haar.
- Geen studio-shoots, geen fashion-photography, geen "golden hour magic". Alles moet eruitzien als een doodgewone iPhone-snapshot of mirror-selfie of friend-snap.
- Geen explicit content. Geen naakt, geen topless, geen lingerie-shoots. (Aparte templates daarvoor bestaan elders.)
- VARIATIE is het hele doel: per batch een mix van outdoor/indoor, dag/avond, selfie/friend-snap/mirror, verschillende seizoenen, verschillende landen/steden, verschillende outfits.
- ABSOLUUT NOOIT BLUR EN NOOIT AFSTANDS-SFEER. Twee categorieën verboden tokens in ALLE velden (scene/camera/backdrop/lighting/capture/outfit/pose):

  Categorie 1 — directe blur-tokens:
  "blur", "blurry", "blurred", "out of focus", "out-of-focus", "defocused", "bokeh", "shallow depth of field", "shallow DoF", "portrait mode", "soft focus", "motion blur", "creamy bokeh", "lens blur", "soft background", "soft blurred", "softly blurred", "dreamy soft", "smooth background", "creamy backdrop", "soft glow background", "blurry-far".

  Categorie 2 — afstands/sfeer-tokens die het model óók als "blur dit" interpreteert:
  "distant", "in the distance", "far away", "far behind", "stretching out behind", "extending into the distance", "fading into", "silhouettes", "figures", "vague shapes", "vague forms", "abstract shapes", "atmospheric", "moody atmospheric", "hazy", "misty", "barely visible", "a sense of", "hints of", "softly lit background".

  Vervang ze door concreet positioneren met benoemde objecten op een vaste afstand: niet "people in the distance" maar "three pedestrians 4 meters back wearing red, navy and beige coats". Niet "atmospheric crowd" maar "five shoppers within 3 meters, one in a green hoodie pushing a metal cart, two chatting near the produce section". Niet "softly lit shelves stretching out behind" maar "supermarket shelves 2 meters back fully stocked with colorful product packaging clearly visible".

  Achtergrond-objecten (mensen, voertuigen, gebouwen, schappen) moeten ALTIJD herkenbaar, dichtbij EN scherp beschreven worden, NIET als sfeerelement. Templates die toch tokens uit categorie 1 of 2 bevatten worden silently geweigerd.
- IEDERE template MOET in het capture-veld expliciet noemen: "iPhone main wide-angle camera" of "phone wide-angle 24mm" + "deep focus" / "everything sharp" / "background fully detailed". Dit is een harde technische eis — zonder die tokens valt het diffusion-model terug op portrait-mode bokeh en dat is een instant reject.

VERPLICHTE VARIATIE BINNEN ÉÉN RESPONSE:
- Geen twee templates met dezelfde locatie-type. Niet 3× "cafe terras", niet 5× "strand".
- Geen twee templates met (vrijwel) dezelfde outfit. Geen 4× "denim jacket".
- Spreid kind: ~30% avatar, ~60% gallery, ~10% mixed.
- Spreid leeftijd-geschiktheid: een mix van "kan op een 22-jarige" en "kan op een 55-jarige" templates. Senioren-templates: minder festival/club, meer parken/cafés/cultuur/wandeling/tuin.

ANTI-CLICHE:
- Vermijd "girl with coffee cup at cafe terrace" — dat hebben we al te veel.
- Vermijd "golden hour" / "magic hour" als lighting — diffusion overdoet dat.
- Vermijd "looking dreamily into the distance" — saai, verzadigd.
- Probeer juist: regen, mist, fluorescent licht, supermarkt, parkeergarage, badkamerspiegel zonder make-up, in de auto, op de fiets, in het OV, sneeuw, snikheet, op een feestje, in een ziekenhuis-wachtkamer, kinderspeeltuin, jaarmarkt — alledaagse Nederlandse situaties.`;

function userPrompt(opts: {
  count: number;
  fewShot: SceneTemplate[];
  rejections: Awaited<ReturnType<typeof loadRecentRejections>>;
  hints: string[];
}): string {
  const parts: string[] = [];
  parts.push(`Genereer ${opts.count} nieuwe scene-templates volgens het schema.`);

  if (opts.hints.length > 0) {
    parts.push("\nExtra wensen voor deze batch:");
    for (const h of opts.hints) parts.push(`- ${h}`);
  }

  if (opts.fewShot.length > 0) {
    parts.push("\nVoorbeelden van GOEDE templates (gebruik dezelfde stijl en specificiteit, maar GEEN herhalingen daarvan):");
    parts.push(JSON.stringify({ examples: opts.fewShot }, null, 2));
  }

  if (opts.rejections.length > 0) {
    parts.push(
      "\nDe operator heeft eerder de onderstaande templates AFGEWEZEN. Maak NIET dezelfde fouten:",
    );
    for (const r of opts.rejections) {
      const tagLine = r.rejection_tags.length > 0
        ? ` [tags: ${r.rejection_tags.join(", ")}]`
        : "";
      parts.push(
        `- afgewezen: "${r.scene.slice(0, 80)}" — outfit "${r.outfit.slice(0, 60)}" — reden: ${r.rejection_reason.slice(0, 200)}${tagLine}`,
      );
    }
  }

  parts.push(
    `\nOutput exact ${opts.count} templates in de "templates" array. Geen extra velden, geen commentaar.`,
  );
  return parts.join("\n");
}

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function coerceKind(v: unknown): SceneTemplate["kind"] {
  if (typeof v !== "string") return "gallery";
  const t = v.trim().toLowerCase();
  return (KIND_VALUES as readonly string[]).includes(t)
    ? (t as SceneTemplate["kind"])
    : "gallery";
}

function coerceTemplate(raw: unknown): SceneTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Scrub blur tokens out of every field at intake time, even though
  // the prompt-builder scrubs again at render time. Belt-and-braces:
  // the stored DB row stays clean so the admin UI shows what will
  // actually be rendered, instead of misleadingly listing a backdrop
  // that includes "out-of-focus crowd" while the renderer silently
  // erases it.
  const t: SceneTemplate = {
    scene: stripBlurPhrases(clean(r.scene, 400)),
    camera: stripBlurPhrases(clean(r.camera, 400)),
    backdrop: stripBlurPhrases(clean(r.backdrop, 600)),
    lighting: stripBlurPhrases(clean(r.lighting, 300)),
    capture: stripBlurPhrases(clean(r.capture, 300)),
    outfit: stripBlurPhrases(clean(r.outfit, 600)),
    pose: stripBlurPhrases(clean(r.pose, 500)),
    kind: coerceKind(r.kind),
  };
  // Reject obviously-broken templates: every prompt-relevant field
  // must have at least a few characters of actual content. Without
  // these the diffusion render is a mess.
  if (
    t.scene.length < 8 ||
    t.camera.length < 8 ||
    t.backdrop.length < 8 ||
    t.lighting.length < 6 ||
    t.capture.length < 6 ||
    t.outfit.length < 12 ||
    t.pose.length < 12
  ) {
    return null;
  }
  return t;
}

function stripJsonNoise(text: string): string {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  return s;
}

export type GenerateBatchOpts = {
  count: number;
  /** Free-form operator hints for this batch ("meer 50+", "meer
   * outdoor", "geen cafés"). Plumbed straight into the user prompt. */
  hints?: string[];
};

export type GenerateBatchResult =
  | {
      ok: true;
      templates: SceneTemplate[];
      droppedInvalid: number;
      model: string;
      rawTextPreview: string;
    }
  | { ok: false; error: string; rawText?: string };

export async function generateSceneTemplateBatch(
  service: SupabaseClient,
  opts: GenerateBatchOpts,
): Promise<GenerateBatchResult> {
  const count = Math.max(1, Math.min(80, Math.floor(opts.count)));

  const [fewShot, rejections] = await Promise.all([
    sampleActiveTemplatesForFewShot(service, 8),
    loadRecentRejections(service, 20),
  ]);

  const user = userPrompt({
    count,
    fewShot,
    rejections,
    hints: (opts.hints ?? []).filter((s) => typeof s === "string" && s.trim().length > 0),
  });

  // Aim for ~250 output tokens per template (each template is ~7 short
  // sentences). With a 50-template batch that's ~12k tokens, which
  // Grok-4 can produce in one go but we keep it bounded.
  const maxOut = Math.min(16_000, Math.max(2_000, count * 280));

  const res = await grokResponsesComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    {
      temperature: 0.9, // High creativity, we want variety
      maxOutputTokens: maxOut,
    },
  );

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  const stripped = stripJsonNoise(res.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    return {
      ok: false,
      error: `JSON parse faalde: ${err instanceof Error ? err.message : String(err)}`,
      rawText: res.text.slice(0, 1000),
    };
  }

  const arr = (() => {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.templates)) return obj.templates;
    }
    return null;
  })();

  if (!arr) {
    return {
      ok: false,
      error: "Grok-output bevat geen `templates` array.",
      rawText: res.text.slice(0, 1000),
    };
  }

  const templates: SceneTemplate[] = [];
  let dropped = 0;
  for (const raw of arr) {
    const t = coerceTemplate(raw);
    if (t) templates.push(t);
    else dropped++;
  }

  if (templates.length === 0) {
    return {
      ok: false,
      error: `Geen geldige templates gevonden in Grok-output (${dropped} verworpen).`,
      rawText: res.text.slice(0, 1000),
    };
  }

  return {
    ok: true,
    templates,
    droppedInvalid: dropped,
    model: res.model,
    rawTextPreview: res.text.slice(0, 200),
  };
}

/** Re-export for routes that want to validate operator-supplied tags
 * before passing them along to the store. */
export type { RejectionTag };
