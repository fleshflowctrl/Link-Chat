import { PaymentMethodsView } from "@/components/me/payment-methods-view";
import { fetchUserPaymentMethodsServer } from "@/lib/payment/server-payment-methods";

export default async function MePaymentPage() {
  const initialMethods = await fetchUserPaymentMethodsServer();
  return <PaymentMethodsView initialMethods={initialMethods} />;
}
