import { getPublicCheckoutData } from "@/lib/dashboard/server";
import CustomerCheckout from "../../../views/CustomerCheckout";

/** Route: /checkout/[id] — public customer-facing checkout page. */
export default async function CheckoutByIdPage({
  params,
}: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  const data = await getPublicCheckoutData(id);
  return <CustomerCheckout initialData={data} />;
}
