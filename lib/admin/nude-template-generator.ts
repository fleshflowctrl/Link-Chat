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

BELANGRIJK: de scene-omschrijving MOET het woord "naakt" of "naakte" bevatten — dat is de trigger voor de explicit-content render-path. Zonder dat woord wordt het een normale gekleeden foto.

Velden uitgelegd:
- scene (Nederlands, 1 zin): WAT ze doet en WAAR. Concrete situatie. MOET "naakt" of "naakte" bevatten. Voorbeelden van GROTE VARIATIE in scenes:
  • "naakt op handen en voeten op de keukenvloer, kont naar camera"
  • "naakte vrouw zit op de bank met laptop open, benen wijd, vlak voor camera"
  • "naakt liggend met benen omhoog tegen de muur, telefoon op vloer"
  • "naakte vrouw in een hotelkamer, op handen en knieën op het bed, gezicht in lakens"
  • "naakt op een gymmat in de woonkamer, doet yoga in cobra-pose"
  • "naakte foto vanaf bovenaf, ze ligt op haar rug op tegelvloer"
  • "naakt in douchecabine met natte haren, glasdeuren open"
  • "naakt zittend op bureaustoel met benen wijd over de armleuningen"
  • "naakte close-up van borsten, telefoon bijna tegen huid"
  • "naakte vrouw bukt voorover op aanrecht in keuken"
  • "naakt op trap zittend met benen gespreid"
  • "naakte foto in inloopkast, kleren om haar heen op de grond"
  • "naakte vrouw op make-uptafel zittend, voor make-upspiegel"
  • "naakt staand voor groot raam met avondstad erachter, camera vanaf zij"
  • "naakte zelf-portret op zolder met dakraam, op vloerkleed liggend"
  Vermijd: ALTIJD "spiegel selfie in slaapkamer/badkamer" — dat is de DEFAULT die diffusion al zelf produceert.
- camera (Engels): camera-afstand/hoek/framing als diffusion-tokens. ALLEEN self-taken varianten. Voorbeelden:
  • "mirror selfie, phone held in her own hand, arm visible in reflection, full body"
  • "arm extended high above her head, POV looking down at her own body lying on bed"
  • "extreme close-up of breasts, phone held very close to chest, only boobs and torso visible"
  • "phone held between her legs pointing up, low angle looking at pussy and stomach"
  • "selfie from behind over her own shoulder, looking back at the lens, ass and back visible"
  • "tight crop on pussy only, phone very close between spread legs, detailed view"
  • "feet and lower legs in frame, phone held at knee height pointing down at her own feet"
  • "high angle selfie, phone above her head, full body lying on floor with legs spread"
  • "close-up of one breast and nipple, phone almost touching skin, soft bedroom light"
  • "selfie in bathroom mirror, phone covering part of her face, other hand spreading pussy"
  • "arm extended sideways, 3/4 body angle, full torso and pussy visible"
  • "phone held low between thighs, looking down at her own spread legs and pussy"
  Vermijd: ALLES wat "friend", "girlfriend", "timer", "tripod", "someone else" bevat. Vermijd ook de standaard "staande spiegel selfie met telefoon in hand" te vaak.
- backdrop (Engels): zichtbare achtergrond met SPECIFIEKE details. NIET alleen "bedroom". Voorbeelden:
  • "modern Scandinavian kitchen with white cabinets, coffee maker on counter, plant on windowsill"
  • "small Dutch apartment hallway with coat rack, jackets hanging, wooden floor"
  • "narrow Amsterdam canal-house staircase with steep wooden steps and white walls"
  • "hotel room with king bed, leather headboard, city view through floor-to-ceiling window"
  • "messy home gym corner, yoga mat on floor, dumbbells, towel thrown on floor"
  • "balcony at dusk, plant pots, string lights, fairy lights wrapped on railing"
  • "walk-in closet with hanging clothes around her, neutral beige carpet, full-length mirror"
  • "kitchen counter with cutting board and herbs, kitchen towel, induction hob visible"
  • "wooden desk with monitor, scattered notebooks, coffee mug, ergonomic chair"
  • "vintage attic bedroom with sloped ceiling, skylight, wooden beams"
  • "Spa bathroom with stone tiles, free-standing oval tub, candles"
- lighting (Engels): concrete licht-tokens. Voorbeelden:
  • "harsh direct phone flash from the front, hard shadows behind body"
  • "single warm desk lamp from the side, dramatic golden side shadows"
  • "blueish evening twilight through window, cool tones on skin"
  • "fluorescent ceiling light in modern bathroom, even flat lighting"
  • "candle light only, very warm orange tones, intimate"
  • "string-light fairy glow from above, multi-point soft warm pinpoints"
  • "bright midday sun streaming through window, sharp window-frame shadow on body"
- capture (Engels): apparaat-feel. MOET altijd "self-taken" of "her own phone" bevatten.
  • "real self-taken iPhone photo from her own camera roll, slightly imperfect angle"
  • "amateur mirror selfie on her personal iPhone, unedited, casual framing"
  • "self-taken Samsung phone photo, slightly warmer tones, from her camera roll"
  • "her own phone, front camera, real amateur self-portrait, no edits"
- outfit (Engels): MOET expliciet naakt zijn, maar met VARIATIE in detail:
  • "completely nude, hair tied up in messy bun, no jewellery"
  • "completely nude, water droplets on skin, wet hair"
  • "completely nude with thin gold necklace and small earrings"
  • "completely nude with visible tan lines from bikini"
  • "completely nude, red painted toenails, ankle bracelet"
  • "completely nude, slight goose bumps from cool air"
  • "completely nude, hair freshly washed and dripping wet"
- pose (Engels): exacte lichaamshouding. ZIE de POSE-DISTRIBUTIE regels hieronder — geen 4 staande poses in 1 batch.

HARDE REGELS — LEES DIT EERST:
- ALLE personas zijn vrouwen tussen 18 en 99 met middellang tot lang haar. Iedere template moet werken voor élke leeftijd binnen dat bereik.
- **ABSOLUUT ZELF-GENOMEN**: Iedere foto moet genomen zijn door de vrouw ZELF met haar eigen telefoon. Haar hand, arm, of telefoon moet zichtbaar zijn in de foto of duidelijk gereflecteerd in een spiegel. Nooit "genomen door een vriendin", "door haar partner", "timer op de kast", "tripod", "iemand anders hield de camera".
- Iedere template moet écht en geloofwaardig zijn als amateur self-taken nude photo. Geen studio, geen professionele fotografie, geen "art nude" abstractie.
- **BODY-PART CLOSE-UPS ZIJN TOEGESTAAN EN GEWENST**: Ongeveer 20-25% van de templates mag een strakke close-up zijn van alleen borsten, alleen pussy, alleen billen, dijen, voeten, of een combinatie (bijv. borsten + buik, of pussy close-up met gespreide benen). Dit maakt de exclusive content veel realistischer en gevarieerder.
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

VERPLICHTE CAMERA-DISTRIBUTIE (per batch) — ALLEEN self-taken:
- Verspreid over MINSTENS 7 verschillende self-taken camera-types:
  1. mirror-selfie (max 20% van batch — staand én niet-staand, veel variatie in hoek en afstand)
  2. arm-extended selfie zonder spiegel (telefoon in eigen hand, arm zichtbaar in frame)
  3. POV van bovenaf (telefoon hoog boven hoofd gehouden terwijl ze ligt of hurkt)
  4. low angle / tussen benen (telefoon laag gehouden of tussen dijen, kijkend naar pussy of lichaam)
  5. extreme body-part close-up (borsten alleen, pussy alleen, billen close-up, voeten, tepels, etc. — telefoon bijna tegen huid)
  6. over-de-schouder van achteren (kijkend naar eigen reflectie of direct naar lens)
  7. high-angle full body liggend (telefoon boven hoofd, hele lichaam met gespreide benen)
  8. sideways / 3/4 arm-extended (lichaam schuin, telefoon aan de zijkant)

BELANGRIJK: Close-up body-part templates (borsten, pussy, billen, voeten) zijn gewenst en moeten ongeveer 20-25% van de batch uitmaken. Dit maakt de exclusive content veel realistischer voor dating-app gebruik.

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
