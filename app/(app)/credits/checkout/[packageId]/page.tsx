import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/credits/checkout-view";
import { packages } from "@/data/credits";

export default function CreditsCheckoutPage({
  params,
}: {
  params: { packageId: string };
}) {
  const pkg = packages.find((p) => p.id === params.packageId);
  if (!pkg) notFound();

  return <CheckoutView pkg={pkg} />;
}
