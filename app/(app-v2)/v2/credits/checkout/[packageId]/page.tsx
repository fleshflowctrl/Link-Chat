import { notFound, redirect } from "next/navigation";
import { CheckoutView } from "@/components/credits/checkout-view";
import { resolveCheckoutPackage } from "@/lib/credits/resolve-checkout-package";

export default async function CreditsCheckoutPage({
  params,
  searchParams,
}: {
  params: { packageId: string };
  searchParams?: {
    success?: string;
    canceled?: string;
    session_id?: string;
  };
}) {
  const resolved = await resolveCheckoutPackage(params.packageId);
  if (!resolved) notFound();
  if (resolved === "unavailable") {
    redirect("/credits");
  }

  return (
    <CheckoutView
      pkg={resolved}
      query={{
        success: searchParams?.success,
        canceled: searchParams?.canceled,
        session_id: searchParams?.session_id,
      }}
    />
  );
}
