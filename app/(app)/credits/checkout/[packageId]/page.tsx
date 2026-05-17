import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/credits/checkout-view";
import { packages } from "@/data/credits";

export default function CreditsCheckoutPage({
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
  const pkg = packages.find((p) => p.id === params.packageId);
  if (!pkg) notFound();

  return (
    <CheckoutView
      pkg={pkg}
      query={{
        success: searchParams?.success,
        canceled: searchParams?.canceled,
        session_id: searchParams?.session_id,
      }}
    />
  );
}
