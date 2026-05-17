/** Shared swap logic for persona avatar ↔ gallery (admin UI + API). */
export function swapPersonaAvatarWithGallery(
  previousAvatar: string,
  galleryUrls: string[],
  newAvatar: string,
): { avatar_url: string; gallery_urls: string[] } {
  if (!newAvatar) {
    return { avatar_url: "", gallery_urls: galleryUrls };
  }

  const idx = galleryUrls.indexOf(newAvatar);
  const prev = previousAvatar.trim();

  if (idx >= 0) {
    if (!prev || prev === newAvatar) {
      return {
        avatar_url: newAvatar,
        gallery_urls: galleryUrls.filter((u) => u !== newAvatar),
      };
    }
    const swapped = galleryUrls.map((u, i) => (i === idx ? prev : u));
    const gallery_urls = swapped.filter((u, i) => u !== prev || i === idx);
    return { avatar_url: newAvatar, gallery_urls };
  }

  const gallery_urls = [...galleryUrls];
  if (prev && prev !== newAvatar && !gallery_urls.includes(prev)) {
    gallery_urls.push(prev);
  }
  return { avatar_url: newAvatar, gallery_urls };
}
