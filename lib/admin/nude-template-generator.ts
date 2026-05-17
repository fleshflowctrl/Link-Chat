/**
 * Grok-driven explicit nude scene template generator.
 *
 * Same architecture as scene-template-generator.ts, but with an
 * explicit-content system prompt that produces nude templates. The
 * output schema is identical (the seven SceneTemplate fields + kind),
 * but `kind` is forced to "nude" so the normal avatar/gallery picker
 * never accidentally selects an explicit template.
 *
 * Variation is the whole point: every template should describe a
 * meaningfully different pose, angle, location, and lighting so the
 * generated photos don't all look alike.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import type { SceneTemplate } from "@/lib/images/scene-templates";
import { stripBlurPhrases } from "@/lib/images/persona-photo-prompt";
import { loadRecentNudeRejections, sampleActiveNudeTemplatesForFewShot } from "@/lib/admin/scene-templates-store";

const SYSTEM_PROMPT = `Je genereert EXPLICIETE NUDE scene-templates voor een Nederlandse AI-dating-app. Elke template wordt gebruikt om EEN naaktfoto van een persona te renderen via een diffusion-model.

Output STRIKT geldige JSON, niets anders. Geen markdown-fences, geen toelichting, geen voor- of natekst — alleen één JSON-object met de vorm:

{
  "templates": [
    { "scene": "...", "camera": "...", "backdrop": "...", "lighting": "...", "capture": "...", "outfit": "...", "pose": "..." },
    ...
  ]
}

Velden uitgelegd:
- scene (Nederlands of mix NL/EN, 1 zin): WAT ze doet en WAAR. Concrete situatie. Bijv: "naakte spiegel selfie in slaapkamer 's ochtends na het opstaan", "naakte badkamer selfie na het douchen met natte haren", "liggend naakt op bed bij avondlicht".
- camera (Engels): camera-afstand/hoek/framing als diffusion-tokens. Bijv: "low angle phone selfie from below, arm visible, full body slightly from below", "high angle looking down at body, phone held above", "extreme close-up mirror selfie, phone almost touching glass", "3/4 angle from the side, phone at chest height".
- backdrop (Engels): zichtbare achtergrond met specifieke details. Bijv: "messy bedroom, rumpled white duvet, pillows scattered, wooden headboard", "modern bathroom, white tiles, fogged mirror, towel hanging on the side", "bedroom with string lights, soft pink walls, full length mirror".
- lighting (Engels): licht-mood, concrete licht-tokens. Bijv: "soft warm morning window light from the side, gentle shadows on skin", "harsh phone flash direct lighting", "warm lamp light from below, dramatic side shadows", "dim bedroom lamp, intimate mood".
- capture (Engels): apparaat-feel. Bijv: "real amateur mirror selfie, slight motion blur on hand, iPhone front camera", "real self-taken from behind, slightly shaky angle", "real overhead selfie, amateur, slightly imperfect framing", "real bathroom mirror selfie, steam on mirror edges".
- outfit (Engels): MOET expliciet naakt zijn. Verplicht volledig naakt. Bijv: "completely nude, no clothes at all, bare skin, full frontal nudity, breasts and vagina clearly visible", "completely nude, water droplets on skin, no clothes", "completely nude, breasts and pussy in close-up", "completely nude, ass and pussy fully visible from behind".
- pose (Engels): exacte lichaamshouding. Bijv: "standing relaxed in front of mirror, one hand holding phone, other hand resting on hip", "on all fours with back arched, looking back over left shoulder", "lying on back with knees pulled to chest, legs spread wide", "sitting on edge of bathtub with legs open toward camera", "standing on tiptoes with back slightly arched, phone in both hands".

HARDE REGELS:
- ALLE personas zijn vrouwen tussen 18 en 99 met middellang tot lang haar. Iedere template moet werken voor élke leeftijd binnen dat bereik.
- Iedere template moet écht en geloofwaardig zijn als amateur self-taken nude photo. Geen studio, geen professionele fotografie, geen "art nude" abstractie.
- ABSOLUUT NOOIT BLUR. Gebruik NERGENS termen als "blur", "blurry", "blurred", "out of focus", "out-of-focus", "defocused", "bokeh", "shallow depth of field", "shallow DoF", "portrait mode", "soft focus", "motion blur", "creamy bokeh", "lens blur". Alles moet scherp zijn van voor- tot achtergrond zoals een gewone iPhone-snapshot.

VERPLICHTE POSE-DISTRIBUTIE (HARD CHECK — als jouw batch deze verhouding niet haalt, wordt 'ie afgewezen):
- MAX 15% staande spiegel-selfies. Niet meer. Wees concreet streng: in een batch van 20 templates zijn er hooguit 3 staande spiegel-selfies. Punt.
- MINIMAAL 20% liggend (op rug / op buik / op zij / met benen omhoog / in badkuip / op vloer)
- MINIMAAL 15% van-achteren / over-de-schouder / kont-naar-camera
- MINIMAAL 15% zittend (op stoel / bedrand / vloer / vensterbank / trap / aanrecht)
- MINIMAAL 10% knielend / op handen en knieën / squatting
- MINIMAAL 10% creatieve hoeken: POV van bovenaf (vogelperspectief), POV van onder, extreme close-up van lichaamsdeel (borsten / billen / dijen), foto van iemand anders gemaakt, timer op kast, etc.
- De rest (max ~15%) mag staand zonder spiegel / bukkend / leunend / op tafel / etc.

VERPLICHTE LOCATIE-DISTRIBUTIE (per batch):
- Verspreid over MINSTENS 8 verschillende locaties. Voorbeelden van locaties die JE MOET overwegen (niet alleen slaapkamer + badkamer):
  slaapkamer, badkamer (douche/bad/spiegel), woonkamer-bank, keuken, eetkamer, gang/hal, kantoor/werkkamer, balkon, terras, slaapkamer-vloer, voor groot raam, in kledingkast/inloopkast, op trap, in auto, hotelkamer, sauna, kelder/bijkeuken, zolder, tuinhuis, vakantiehuis-living, airbnb, op make-up tafel, op aanrecht keuken, half in douchecabine, op gymmat in woonkamer, in stoel-onder-leeslampje, op bureaustoel met benen open, boven op wasmachine.
- Verspreid ook over MINSTENS 6 verschillende meubelstukken of decor-elementen (bed, bank, stoel, badkuip, sink, vloerkleed, bureau, vensterbank, trap, aanrecht, tafel).

VERPLICHTE CAMERA-DISTRIBUTIE (per batch):
- Verspreid over MINSTENS 6 verschillende camera-types:
  1. mirror-selfie (max 25% van batch — staand én niet-staand samen, dus zelfs in deze categorie veel variatie),
  2. arm-held selfie zonder spiegel (gezicht naar camera vanaf arm-lengte),
  3. POV van bovenaf (telefoon boven gehouden tijdens liggen),
  4. POV van onderen (telefoon op grond / heupniveau),
  5. timer/tripod op kast/plank (geen arm zichtbaar, hele lichaam in beeld),
  6. close-up van specifiek lichaamsdeel (borsten, dijen, billen, schaamstreek-area in detail),
  7. door iemand anders gemaakt (vriendin/partner, hele compositie wijder).

VERPLICHTE BODY-VISIBILITY DISTRIBUTIE:
- Niet ELKE template hoeft volledig frontaal lichaam te tonen. Mix:
  - Volledig lichaam frontaal: ~30%
  - Volledig lichaam van zij/3/4: ~20%
  - Volledig lichaam van achter: ~15%
  - Bovenlichaam close-up (borsten/torso): ~15%
  - Onderlichaam close-up (heupen-naar-boven of dijen): ~10%
  - Specifieke detail-shot (één borst, billen, tussen benen): ~10%

VERPLICHTE LICHT-DISTRIBUTIE:
- Mix van: helder daglicht, schemerlicht, lamplicht (warme tint), badkamer-tl, harde phone-flash, gouden namiddag, blauwe avondtint, koude winter-daglicht, zonsondergang via raam.
- Geen 2 templates met identieke lichtomschrijving.

OUTFIT-VARIATIE (zelfs volledig naakt kan variëren):
- "completely nude with water droplets on skin"
- "completely nude with wet hair clinging to shoulders"
- "completely nude, slight tan lines visible from bikini"
- "completely nude with silver necklace and small earrings only"
- "completely nude with ankle bracelet visible"
- "completely nude with hair tied up in messy bun"
- "completely nude with hair loose past shoulders"
- "completely nude, freshly out of bed, no makeup"
- "completely nude with light makeup, looks polished"
- "completely nude with red painted toenails visible"

ANTI-CLICHE — DEZE FOUTEN AUTOMATISCH AFWIJZEN:
- ❌ 3+ staande spiegel-selfies in 1 batch
- ❌ "girl in lingerie" — outfit MOET expliciet naakt zijn
- ❌ Vage poses zoals "sexy pose" — wees concreet over handen, benen, gezichtsrichting, blik
- ❌ Twee templates met (vrijwel) zelfde achtergrond zoals "white tiled bathroom" 2×
- ❌ Templates die alleen verschillen in lichte detail-variatie van dezelfde basis-pose`;

function userPrompt(opts: {
  count: number;
  fewShot: SceneTemplate[];
  rejections: Awaited<ReturnType<typeof loadRecentNudeRejections>>;
  hints: string[];
}): string {
  const parts: string[] = [];
  parts.push(`Genereer ${opts.count} nieuwe NUDE scene-templates volgens het schema. Maximale variatie.`);

  if (opts.hints.length > 0) {
    parts.push("\nExtra wensen voor deze batch:");
    for (const h of opts.hints) parts.push(`- ${h}`);
  }

  if (opts.fewShot.length > 0) {
    parts.push("\nVoorbeelden van GOEDE nude templates (gebruik dezelfde stijl en specificiteit, maar GEEN herhalingen daarvan):");
    parts.push(JSON.stringify({ examples: opts.fewShot }, null, 2));
  }

  if (opts.rejections.length > 0) {
    parts.push(
      "\nDe operator heeft eerder de onderstaande templates AFGEWEZEN. Maak NIET dezelfde fouten:",
    );
    for (const r of opts.rejections) {
      const tagLine = r.rejection_tags && r.rejection_tags.length > 0
        ? ` [tags: ${r.rejection_tags.join(", ")}]`
        : "";
      parts.push(
        `- afgewezen: "${r.scene.slice(0, 80)}" — pose "${r.pose.slice(0, 60)}" — reden: ${(r.rejection_reason ?? "").slice(0, 200)}${tagLine}`,
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

function coerceTemplate(raw: unknown): SceneTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Force outfit to contain at least "nude" markers — if Grok hallucinates
  // a clothed outfit we reinforce on the way in.
  let outfit = stripBlurPhrases(clean(r.outfit, 600));
  if (!/naakt|nude|bare skin|no clothes|topless|breasts|vagina|pussy/i.test(outfit)) {
    outfit = `completely nude, no clothes at all, bare skin, full frontal nudity, ${outfit}`.trim();
  }

  // We use kind="gallery" + category="nude" so we don't need to change
  // the scene_templates CHECK constraint. The category marker is set on
  // insert by the API route (see /api/admin/nude-templates/generate-batch).
  const t: SceneTemplate = {
    scene: stripBlurPhrases(clean(r.scene, 400)),
    camera: stripBlurPhrases(clean(r.camera, 400)),
    backdrop: stripBlurPhrases(clean(r.backdrop, 600)),
    lighting: stripBlurPhrases(clean(r.lighting, 300)),
    capture: stripBlurPhrases(clean(r.capture, 300)),
    outfit,
    pose: stripBlurPhrases(clean(r.pose, 500)),
    kind: "gallery",
  };

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

export type GenerateNudeBatchOpts = {
  count: number;
  hints?: string[];
};

export type GenerateNudeBatchResult =
  | {
      ok: true;
      templates: SceneTemplate[];
      droppedInvalid: number;
      model: string;
      rawTextPreview: string;
    }
  | { ok: false; error: string; rawText?: string };

export async function generateNudeTemplateBatch(
  service: SupabaseClient,
  opts: GenerateNudeBatchOpts,
): Promise<GenerateNudeBatchResult> {
  const count = Math.max(1, Math.min(80, Math.floor(opts.count)));

  const [fewShot, rejections] = await Promise.all([
    sampleActiveNudeTemplatesForFewShot(service, 6),
    loadRecentNudeRejections(service, 15),
  ]);

  const user = userPrompt({
    count,
    fewShot,
    rejections,
    hints: (opts.hints ?? []).filter((s) => typeof s === "string" && s.trim().length > 0),
  });

  const maxOut = Math.min(16_000, Math.max(2_000, count * 280));

  const res = await grokResponsesComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    {
      temperature: 0.95, // Even higher creativity for max variation
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
      error: `Geen geldige nude templates gevonden in Grok-output (${dropped} verworpen).`,
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
