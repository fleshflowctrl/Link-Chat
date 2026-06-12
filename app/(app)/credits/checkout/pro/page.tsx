import { redirect } from "next/navigation";

/** Pro subscription removed — redirect to credit packs. */
export default function ProCheckoutRedirectPage() {
  redirect("/credits");
}
