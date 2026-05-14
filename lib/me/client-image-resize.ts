/**
 * Client-side image downscale to keep uploads fast and under storage limits.
 *
 * Modern phone cameras produce 6–12 MB JPEGs which would otherwise blow past
 * the storage bucket size limit, leaving the user with a silently failing
 * "Add photo" button. Resizing in the browser fixes that AND makes uploads
 * feel instant.
 */

const MAX_DIM = 1920;
const JPEG_QUALITY = 0.85;

export async function resizeImageForUpload(file: File): Promise<File> {
  // Animated formats and SVGs aren't candidates for canvas resize — pass them
  // through untouched so the original is uploaded.
  if (
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    !file.type.startsWith("image/")
  ) {
    return file;
  }

  // If the file is already small, skip the round-trip through canvas.
  if (file.size <= 1_500_000) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Browsers can occasionally fail to decode (e.g. iOS HEIC pretending to
    // be JPEG). Fall back to the original — the upload step will still try.
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetW, targetH)
      : Object.assign(document.createElement("canvas"), {
          width: targetW,
          height: targetH,
        });

  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas)
    .getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) => {
    if ("convertToBlob" in canvas) {
      (canvas as OffscreenCanvas)
        .convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY })
        .then(resolve)
        .catch(() => resolve(null));
      return;
    }
    (canvas as HTMLCanvasElement).toBlob(
      (b) => resolve(b),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}
