import type { Profile } from "@/data/profiles";
import type { DiscoveryPreferencesV1 } from "@/lib/discovery-preferences";

function norm(s: string): string {
  return s.toLowerCase();
}

/** Score hoger = beter match met opgeslagen voorkeuren. */
export function scoreProfileForPreferences(
  p: Profile,
  prefs: DiscoveryPreferencesV1,
): number {
  let score = 0;

  if (p.age >= prefs.ageMin && p.age <= prefs.ageMax) {
    score += 40;
  } else if (p.age >= prefs.ageMin - 3 && p.age <= prefs.ageMax + 3) {
    score += 15;
  }

  const hay = norm(`${p.lookingFor} ${p.bio} ${p.interests.map((i) => i.label).join(" ")}`);

  for (const tag of prefs.interestPicks) {
    if (hay.includes(norm(tag))) score += 12;
  }

  switch (prefs.datingIntent) {
    case "serious":
      if (
        /betekenisvol|diep|doordacht|serieus|verbinding|museum|curator|lezer/.test(
          hay,
        )
      ) {
        score += 18;
      }
      break;
    case "casual":
      if (/casual|speels|luchtig|flirt|leuk|yoga|foodie|gym|hardloop/.test(hay)) {
        score += 18;
      }
      break;
    case "friends":
      if (/vriend|vriendschap|nieuw hier|warm|luister/.test(hay)) score += 18;
      break;
    default:
      score += 4;
  }

  switch (prefs.chatEnergy) {
    case "playful":
      if (p.status.variant === "popular" || p.status.variant === "new")
        score += 10;
      if (/speels|playful|flirt|film|muziek|foodie/.test(hay)) score += 8;
      break;
    case "calm":
      if (p.status.variant === "quiet" || p.status.variant === "online")
        score += 8;
      if (/rust|thee|lees|stil|zacht|eerlijk|nieuwsgierig/.test(hay)) score += 10;
      break;
    case "both":
      score += 6;
      break;
  }

  return score;
}

export function sortProfilesForPreferences(
  profiles: Profile[],
  prefs: DiscoveryPreferencesV1 | null,
): Profile[] {
  if (!prefs || profiles.length <= 1) return [...profiles];

  const scored = profiles.map((p) => ({
    p,
    s: scoreProfileForPreferences(p, prefs),
  }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.p);
}
