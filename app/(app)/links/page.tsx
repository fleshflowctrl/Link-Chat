import { redirect } from "next/navigation";

/** Exclusive content store removed for now — send old bookmarks to Discover. */
export default function LinksPage() {
  redirect("/discover");
}
