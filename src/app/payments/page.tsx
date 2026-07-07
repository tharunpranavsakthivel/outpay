import { getPaymentsPageData } from "@/lib/dashboard/server";
import Payments from "../../views/Payments";

/** Route: /payments */
export default async function PaymentsPage() {
  const data = await getPaymentsPageData();
  return <Payments initialData={data} />;
}
