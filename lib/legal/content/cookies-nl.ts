import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_SITE_LABEL } from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

export const cookiesNl: LegalDocument = {
  title: "Cookiebeleid",
  subtitle: LEGAL_SITE_LABEL,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "what",
      title: "1. Wat zijn cookies",
      paragraphs: [
        "Cookies en vergelijkbare technieken (localStorage, sessie-opslag) helpen ons de Dienst te laten werken en te verbeteren.",
      ],
    },
    {
      id: "necessary",
      title: "2. Strikt noodzakelijk",
      paragraphs: [
        "Deze zijn nodig voor inloggen, sessies, beveiliging en het onthouden van je app-variant. Zonder deze werkt de site niet goed. Geen toestemming vereist.",
      ],
      bullets: [
        "Supabase auth-sessie;",
        "Guest-sessie (voor anoniem proberen);",
        "whisper_app_variant (v1/v2).",
      ],
    },
    {
      id: "analytics",
      title: "3. Analytics",
      paragraphs: [
        "Wij gebruiken een pseudonieme bezoeker-id (localStorage, whisper:vid) en kunnen Microsoft Clarity gebruiken voor gebruiksstatistieken. Waar de wet toestemming vereist, vragen wij die via een cookiebanner.",
      ],
    },
    {
      id: "manage",
      title: "4. Beheer",
      paragraphs: [
        "Je kunt cookies verwijderen via je browserinstellingen. Let op: dan moet je mogelijk opnieuw inloggen.",
        `Vragen: ${LEGAL_CONTACT_EMAIL}. Zie ook ons privacybeleid.`,
      ],
    },
  ],
};
