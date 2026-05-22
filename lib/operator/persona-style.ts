/** Stable accent colors per persona (peer_id) for operator UI. */

export type PersonaAccent = {
  badgeBg: string;
  badgeText: string;
  headerBar: string;
  bubbleClass: string;
};

const ACCENTS: PersonaAccent[] = [
  {
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-900",
    headerBar: "bg-rose-500",
    bubbleClass: "bg-rose-500",
  },
  {
    badgeBg: "bg-violet-100",
    badgeText: "text-violet-900",
    headerBar: "bg-violet-500",
    bubbleClass: "bg-violet-500",
  },
  {
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-900",
    headerBar: "bg-sky-500",
    bubbleClass: "bg-sky-500",
  },
  {
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-900",
    headerBar: "bg-amber-500",
    bubbleClass: "bg-amber-500",
  },
  {
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-900",
    headerBar: "bg-emerald-500",
    bubbleClass: "bg-emerald-500",
  },
  {
    badgeBg: "bg-fuchsia-100",
    badgeText: "text-fuchsia-900",
    headerBar: "bg-fuchsia-500",
    bubbleClass: "bg-fuchsia-500",
  },
  {
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-900",
    headerBar: "bg-orange-500",
    bubbleClass: "bg-orange-500",
  },
  {
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-900",
    headerBar: "bg-teal-500",
    bubbleClass: "bg-teal-500",
  },
];

function hashPeerId(peerId: string): number {
  let h = 0;
  for (let i = 0; i < peerId.length; i++) {
    h = (h * 31 + peerId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPersonaAccent(peerId: string): PersonaAccent {
  return ACCENTS[hashPeerId(peerId) % ACCENTS.length]!;
}
