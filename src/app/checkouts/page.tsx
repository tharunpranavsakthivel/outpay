import { getCheckoutListPageData } from "@/lib/dashboard/server";
import CheckoutsList from "../../views/CheckoutsList";

/** Route: /checkouts */
export default async function CheckoutsPage() {
  const data = await getCheckoutListPageData();
  return <CheckoutsList initialData={data} />;
}
