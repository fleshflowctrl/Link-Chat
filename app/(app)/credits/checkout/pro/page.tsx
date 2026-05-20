import { ProCheckoutView } from "@/components/credits/pro-checkout-view";

export default function ProCreditsCheckoutPage({
  searchParams,
}: {
  searchParams?: {
    success?: string;
    canceled?: string;
    session_id?: string;
  };
}) {
  return (
    <ProCheckoutView
      query={{
        success: searchParams?.success,
        canceled: searchParams?.canceled,
        session_id: searchParams?.session_id,
      }}
    />
  );
}
