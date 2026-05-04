/**
 * Stable page numbers for quick reference (“page 6”, etc.).
 * Keep in sync when you add routes.
 */
export function getPageNumber(pathname: string): number {
  if (pathname === "/") return 1;
  if (pathname === "/messages/new") return 4;
  if (pathname.startsWith("/messages/")) return 3;
  if (pathname === "/messages") return 2;
  if (pathname === "/likes") return 5;
  if (pathname === "/credits") return 6;
  if (pathname === "/me") return 7;
  if (pathname === "/me/edit") return 8;
  if (pathname === "/me/account") return 9;
  if (pathname === "/me/privacy") return 10;
  if (pathname === "/me/payment") return 11;
  if (pathname === "/me/history") return 12;
  if (pathname === "/me/earn") return 13;
  if (pathname === "/me/help") return 14;
  if (pathname.startsWith("/profile/")) return 15;
  return 0;
}
