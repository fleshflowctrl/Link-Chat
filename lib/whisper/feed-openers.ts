import type { Profile } from "@/data/profiles";

/**
 * Pool of casual conversation openers shown on each feed card. Same profile
 * always gets the same opener (deterministic FNV hash on the id) so the line
 * feels like "her opener" rather than a random label that changes each render.
 */
const OPENERS = [
  "Hey 😊 Zit jij ook gewoon thuis vanavond?",
  "Hoi! Wat is jouw favoriete plek in de stad?",
  "Wat staat er deze week voor je op de planning?",
  "Heb je vandaag al iets leuks gedaan?",
  "Wat is jouw idee van een perfecte zondag? 🌿",
  "Zin in een goede koffie deze week? ☕",
  "Wat luister je nu het liefste? 🎧",
  "Wat maakt jouw weekend altijd goed?",
  "Welke serie kan je écht aanraden?",
  "Wat is jouw favoriete manier om te ontspannen?",
  "Heb je nog leuke plannen voor het weekend?",
  "Wat zou je doen als je morgen vrij was?",
];

function fnv1aHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function openerForProfile(profile: Profile): string {
  const idx = fnv1aHash(profile.id) % OPENERS.length;
  return OPENERS[idx];
}
