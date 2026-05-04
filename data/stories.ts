export type StoryLabelTone = "purple" | "pink" | "orange" | "none";

export interface StoryItem {
  id: string;
  kind: "add_yours" | "default";
  title: string;
  labelTone: StoryLabelTone;
  /** Avatar image; omit for “Add yours” placeholder */
  imageUrl?: string;
}

export const stories: StoryItem[] = [
  {
    id: "add",
    kind: "add_yours",
    title: "Add yours",
    labelTone: "none",
  },
  {
    id: "s1",
    kind: "default",
    title: "Just joined",
    labelTone: "purple",
    imageUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop",
  },
  {
    id: "s2",
    kind: "default",
    title: "Looking to chat",
    labelTone: "pink",
    imageUrl:
      "https://images.unsplash.com/photo-1507591064344-4c8ce05c1c8a?w=200&q=80&auto=format&fit=crop",
  },
  {
    id: "s3",
    kind: "default",
    title: "New here",
    labelTone: "orange",
    imageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80&auto=format&fit=crop",
  },
  {
    id: "s4",
    kind: "default",
    title: "Bored tonight 😄",
    labelTone: "purple",
    imageUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop",
  },
  {
    id: "s5",
    kind: "default",
    title: "Up late",
    labelTone: "pink",
    imageUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80&auto=format&fit=crop",
  },
];
