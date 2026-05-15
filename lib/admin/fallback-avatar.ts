/**
 * Fallback "initials" avatar for auto-generated personas.
 *
 * When Z-Image-Turbo (or whichever image backend) is unavailable —
 * cold-start, rate-limit, no HF_TOKEN, etc. — we still want persona
 * creation to succeed. The validator requires an https avatar_url, so
 * we generate a small SVG ourselves: initials on a deterministic
 * lavender/pink/sky gradient, upload it to Supabase Storage, and use
 * that public URL.
 *
 * The operator can always go to the persona's edit page and click
 * "Genereer testfoto" later to replace this with a real Z-Image-Turbo
 * portrait once the backend is healthy again.
 *
 * SVG was chosen over PNG because:
 *   - We don't have sharp / canvas / @vercel/og available, so producing
 *     PNG bytes server-side would mean adding a heavy dependency.
 *   - SVG is tiny (< 1 KB) and renders crisply at any size.
 *   - Next.js Image will accept it because we enable
 *     `dangerouslyAllowSVG` only for our own Supabase remote pattern.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const PALETTES: Array<{ from: string; to: string; text: string }> = [
  { from: "#a78bfa", to: "#7c3aed", text: "#ffffff" }, // lavender → violet
  { from: "#fda4af", to: "#e11d48", text: "#ffffff" }, // rose
  { from: "#fcd34d", to: "#f59e0b", text: "#1f2937" }, // amber
  { from: "#86efac", to: "#16a34a", text: "#0b3d20" }, // green
  { from: "#7dd3fc", to: "#0284c7", text: "#ffffff" }, // sky
  { from: "#fdba74", to: "#ea580c", text: "#ffffff" }, // orange
  { from: "#f0abfc", to: "#a21caf", text: "#ffffff" }, // fuchsia
  { from: "#fcd5ce", to: "#f97316", text: "#1f2937" }, // peach
];

/** Cheap fnv1a hash so the same name always picks the same palette
 * (predictable visual identity across re-renders). */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickPalette(seedKey: string) {
  const idx = fnv1a(seedKey) % PALETTES.length;
  return PALETTES[idx]!;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Escape user-provided text before injecting into SVG markup. The name
 * comes from Grok's output, but we still treat it as untrusted. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildInitialsSvg(name: string, paletteSeed?: string): string {
  const initials = escapeXml(getInitials(name));
  const palette = pickPalette(paletteSeed || name || "x");
  // 512x512 keeps the file small while still looking sharp on retina.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="220" font-weight="700" fill="${palette.text}"
        letter-spacing="-6">${initials}</text>
</svg>`;
}

export type FallbackAvatarResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

/** Upload a freshly-generated initials SVG for a persona to the public
 * chat-images bucket. Returns the public URL on success. */
export async function uploadFallbackAvatar(
  service: SupabaseClient,
  personaId: string,
  displayName: string,
): Promise<FallbackAvatarResult> {
  const svg = buildInitialsSvg(displayName, personaId);
  const path = `admin-personas/${personaId}/initials-${Date.now()}.svg`;
  const { error: upErr } = await service.storage
    .from("chat-images")
    .upload(path, Buffer.from(svg, "utf8"), {
      contentType: "image/svg+xml",
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  const { data } = service.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: "Kon public URL niet bepalen voor fallback-avatar." };
  }
  return { ok: true, url: data.publicUrl, path };
}
