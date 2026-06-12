import { SITE_DISPLAY, SITE_DOMAIN, SUPPORT_EMAIL } from "@/lib/brand";

export const LEGAL_LAST_UPDATED = "1 juni 2026";

/** Placeholders until KvK/BTW/address are registered. */
export const LEGAL_CONTROLLER_NAME = "[Bedrijfsnaam volgt]";
export const LEGAL_CONTROLLER_ADDRESS = "[Adres volgt]";
export const LEGAL_KVK = "[KvK-nummer volgt]";
export const LEGAL_BTW = "[BTW-nummer volgt]";

export const LEGAL_CONTACT_EMAIL = SUPPORT_EMAIL;
export const LEGAL_COUNTRY = "Nederland";
export const LEGAL_DATA_REGION = "Europese Unie (EU)";

export const LEGAL_PATHS = {
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
} as const;

export const LEGAL_SITE_LABEL = SITE_DISPLAY;
export const LEGAL_SITE_DOMAIN = SITE_DOMAIN;
