const loadedUrls = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function isProfilePhotoPreloaded(url: string): boolean {
  return loadedUrls.has(url);
}

/** Decode a profile photo into the browser cache (direct URL, not /_next/image). */
export function preloadProfilePhoto(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();
  if (loadedUrls.has(url)) return Promise.resolve();

  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loadedUrls.add(url);
      inflight.delete(url);
      resolve();
    };
    img.onerror = () => {
      inflight.delete(url);
      resolve();
    };
    img.src = url;
  });

  inflight.set(url, promise);
  return promise;
}

export function preloadProfilePhotos(urls: string[]): void {
  for (const url of urls) {
    if (url) void preloadProfilePhoto(url);
  }
}

/** Preload the visible card plus nearby swipes (sync, high priority). */
export function preloadProfilePhotosAround(
  profiles: { photo?: string }[],
  index: number,
  ahead = 8,
  behind = 1,
): void {
  const urls: string[] = [];
  const start = Math.max(0, index - behind);
  const end = Math.min(profiles.length - 1, index + ahead);
  for (let i = start; i <= end; i++) {
    const photo = profiles[i]?.photo;
    if (photo) urls.push(photo);
  }
  preloadProfilePhotos(urls);
}

/** Preload the rest of the pack when the main thread is idle. */
export function preloadProfilePhotosIdle(urls: string[]): void {
  const unique = urls.filter((u) => u && !loadedUrls.has(u));
  if (unique.length === 0) return;

  const run = () => preloadProfilePhotos(unique);
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 0);
  }
}
