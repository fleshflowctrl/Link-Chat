/**
 * Post-render "phone snapshot" finish pass.
 *
 * Z-Image-Turbo (and similar portrait-biased diffusion models) often
 * render a razor-sharp subject on a soft/bokeh background — the classic
 * portrait-mode look. We can't reliably kill that via prompt alone
 * because the HF Space ignores negative_prompt entirely.
 *
 * Instead we narrow the sharpness *gap* after the fact:
 *   1. Tiny Gaussian blur on the *whole* frame (subject + background).
 *   2. Light film-grain overlay (ISO noise) on top.
 *
 * Both steps are uniform — we never touch the face region separately,
 * so persona identity tokens stay intact. The result reads closer to a
 * casual handheld iPhone shot where nothing is studio-tack-sharp.
 *
 * Disable with PHONE_PHOTO_FINISH=0. Tune via:
 *   PHONE_PHOTO_BLUR_SIGMA   (default 0.45)
 *   PHONE_PHOTO_GRAIN_OPACITY (default 0.14, 0–1)
 *   PHONE_PHOTO_GRAIN_STRENGTH (default 36, luminance spread)
 */

export type PhonePhotoFinishOpts = {
  blurSigma?: number;
  grainOpacity?: number;
  grainStrength?: number;
};

function finishEnabled(): boolean {
  const raw = (process.env.PHONE_PHOTO_FINISH ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Build an RGBA noise tile for grain overlay. */
function buildGrainTile(
  width: number,
  height: number,
  strength: number,
  opacity: number,
): Buffer {
  const pixels = width * height;
  const buf = Buffer.alloc(pixels * 4);
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  const spread = Math.max(4, Math.min(80, strength));
  for (let i = 0; i < pixels; i++) {
    const v = Math.max(
      0,
      Math.min(255, 128 + Math.round((Math.random() - 0.5) * spread * 2)),
    );
    const o = i * 4;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
    buf[o + 3] = alpha;
  }
  return buf;
}

/**
 * Apply uniform softening + grain. On failure returns the original bytes
 * unchanged so generation never fails because of post-processing.
 */
export async function applyPhonePhotoFinish(
  bytes: Buffer,
  mime: string,
  overrides: PhonePhotoFinishOpts = {},
): Promise<{ bytes: Buffer; mime: string }> {
  if (!finishEnabled()) {
    return { bytes, mime };
  }

  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    const width = meta.width ?? 768;
    const height = meta.height ?? 1024;

    const blurSigma = overrides.blurSigma ?? envNumber("PHONE_PHOTO_BLUR_SIGMA", 0.45);
    const grainOpacity =
      overrides.grainOpacity ?? envNumber("PHONE_PHOTO_GRAIN_OPACITY", 0.14);
    const grainStrength =
      overrides.grainStrength ?? envNumber("PHONE_PHOTO_GRAIN_STRENGTH", 36);

    const grain = buildGrainTile(width, height, grainStrength, grainOpacity);

    let pipeline = sharp(bytes);
    if (blurSigma > 0) {
      pipeline = pipeline.blur(blurSigma);
    }
    pipeline = pipeline.composite([
      {
        input: grain,
        raw: { width, height, channels: 4 },
        blend: "overlay",
      },
    ]);

    let outBytes: Buffer;
    let outMime = mime;
    if (/jpe?g/i.test(mime)) {
      outBytes = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      outMime = "image/jpeg";
    } else if (/webp/i.test(mime)) {
      outBytes = await pipeline.webp({ quality: 92 }).toBuffer();
      outMime = "image/webp";
    } else {
      outBytes = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      outMime = "image/png";
    }

    return { bytes: outBytes, mime: outMime };
  } catch (err) {
    console.warn(
      "[phone-photo-finish] failed, using raw image:",
      err instanceof Error ? err.message : String(err),
    );
    return { bytes, mime };
  }
}
