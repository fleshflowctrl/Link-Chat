import { profiles } from "@/data/profiles";

export const likesStats = {
  /** People you’ve tapped like on */
  peopleYouLiked: 46,
  /** Mutual links count (you both liked each other) */
  mutualLinks: 12,
};

export type MutualLink = {
  profileId: string;
  name: string;
  age: number;
  imageUrl: string;
  verified?: boolean;
  isNew: boolean;
  /** Pink “New ✨” pill (first 1–2 in rail) */
  newPill: boolean;
  linkedLabel: string;
  hasStartedChat: boolean;
  online?: boolean;
};

export type LikedPerson = {
  /** Key for React list (unique even when profileId repeats) */
  key: string;
  profileId: string;
  name: string;
  age: number;
  imageUrl: string;
  status: "linked" | "pending";
};

function P(i: number) {
  return profiles[i % profiles.length];
}

/** 12 mutual links — first 3 are “new” (rail); rest have started chat (list). */
export const mutualLinks: MutualLink[] = [
  {
    profileId: P(0).id,
    name: P(0).name,
    age: P(0).age,
    imageUrl: P(0).imageUrl,
    verified: P(0).isVerified,
    isNew: true,
    newPill: true,
    linkedLabel: "Linked today",
    hasStartedChat: false,
    online: true,
  },
  {
    profileId: P(1).id,
    name: P(1).name,
    age: P(1).age,
    imageUrl: P(1).imageUrl,
    verified: P(1).isVerified,
    isNew: true,
    newPill: true,
    linkedLabel: "Linked today",
    hasStartedChat: false,
    online: true,
  },
  {
    profileId: P(2).id,
    name: P(2).name,
    age: P(2).age,
    imageUrl: P(2).imageUrl,
    verified: P(2).isVerified,
    isNew: true,
    newPill: false,
    linkedLabel: "Linked yesterday",
    hasStartedChat: false,
    online: false,
  },
  {
    profileId: P(3).id,
    name: P(3).name,
    age: P(3).age,
    imageUrl: P(3).imageUrl,
    verified: P(3).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 2d ago",
    hasStartedChat: true,
    online: true,
  },
  {
    profileId: P(4).id,
    name: P(4).name,
    age: P(4).age,
    imageUrl: P(4).imageUrl,
    verified: P(4).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 3d ago",
    hasStartedChat: true,
    online: false,
  },
  {
    profileId: P(5).id,
    name: P(5).name,
    age: P(5).age,
    imageUrl: P(5).imageUrl,
    verified: P(5).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 4d ago",
    hasStartedChat: true,
    online: true,
  },
  {
    profileId: P(0).id,
    name: P(0).name,
    age: P(0).age,
    imageUrl: P(0).gallery[1] ?? P(0).imageUrl,
    verified: P(0).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 5d ago",
    hasStartedChat: true,
    online: false,
  },
  {
    profileId: P(1).id,
    name: P(1).name,
    age: P(1).age,
    imageUrl: P(1).gallery[2] ?? P(1).imageUrl,
    verified: P(1).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 1w ago",
    hasStartedChat: true,
    online: true,
  },
  {
    profileId: P(2).id,
    name: P(2).name,
    age: P(2).age,
    imageUrl: P(2).gallery[3] ?? P(2).imageUrl,
    verified: P(2).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 1w ago",
    hasStartedChat: true,
    online: false,
  },
  {
    profileId: P(3).id,
    name: P(3).name,
    age: P(3).age,
    imageUrl: P(3).gallery[1] ?? P(3).imageUrl,
    verified: P(3).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 2w ago",
    hasStartedChat: true,
    online: true,
  },
  {
    profileId: P(4).id,
    name: P(4).name,
    age: P(4).age,
    imageUrl: P(4).gallery[2] ?? P(4).imageUrl,
    verified: P(4).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 2w ago",
    hasStartedChat: true,
    online: false,
  },
  {
    profileId: P(5).id,
    name: P(5).name,
    age: P(5).age,
    imageUrl: P(5).gallery[3] ?? P(5).imageUrl,
    verified: P(5).isVerified,
    isNew: false,
    newPill: false,
    linkedLabel: "Linked 3w ago",
    hasStartedChat: true,
    online: true,
  },
];

/** 46 people you liked — ~12 linked (same ids as link set for demo overlap). */
export function buildPeopleYouLiked(): LikedPerson[] {
  return Array.from({ length: likesStats.peopleYouLiked }, (_, i) => {
    const base = P(i);
    return {
      key: `liked-${i}`,
      profileId: base.id,
      name: base.name,
      age: base.age,
      imageUrl: base.gallery[i % base.gallery.length] ?? base.imageUrl,
      status: i < 12 ? "linked" : "pending",
    };
  });
}
