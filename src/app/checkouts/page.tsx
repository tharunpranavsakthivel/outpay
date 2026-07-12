import { withMerchantContext } from "@/lib/dashboard/route";
import { getCheckoutListPageData } from "@/lib/dashboard/server";
import CheckoutsList from "../../views/CheckoutsList";

/** Route: /checkouts */
export default async function CheckoutsPage() {
  const data = await withMerchantContext(getCheckoutListPageData, "/checkouts");
  return <CheckoutsList initialData={data} />;
}
