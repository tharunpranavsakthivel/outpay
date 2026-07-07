import { getCreateCheckoutPageData } from "@/lib/dashboard/server";
import CreateCheckout from "../../../views/CreateCheckout";

/** Route: /checkouts/new */
export default async function CreateCheckoutPage() {
  const data = await getCreateCheckoutPageData();
  return <CreateCheckout initialData={data} />;
}
