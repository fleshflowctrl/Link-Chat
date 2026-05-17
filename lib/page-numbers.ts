/**
 * Stable page numbers for quick reference (“page 6”, etc.).
 * Keep in sync when you add routes.
 */
export function getPageNumber(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/discover" || pathname.startsWith("/discover/")) return 1;
  if (pathname === "/messages/new") return 4;
  if (pathname.startsWith("/messages/")) return 3;
  if (pathname === "/messages") return 2;
  if (pathname === "/credits" || pathname.startsWith("/credits/")) return 5;
  if (pathname === "/me") return 6;
  if (pathname === "/me/settings") return 7;
  if (pathname === "/me/edit") return 8;
  if (pathname === "/me/account") return 9;
  if (pathname === "/me/privacy") return 10;
  if (pathname === "/me/payment") return 11;
  if (pathname === "/me/history") return 12;
  if (pathname === "/me/earn") return 13;
  if (pathname === "/me/help") return 14;
  if (pathname === "/me/collection") return 17;
  if (pathname.startsWith("/profile/")) return 15;
  if (pathname === "/notifications") return 16;
  return 0;
}
