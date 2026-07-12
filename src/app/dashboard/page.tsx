import { withMerchantContext } from "@/lib/dashboard/route";
import { getDashboardPageData } from "@/lib/dashboard/server";
import MerchantDashboard from "../../views/MerchantDashboard";

/** Route: /dashboard */
export default async function DashboardPage() {
  const data = await withMerchantContext(getDashboardPageData, "/dashboard");
  return <MerchantDashboard initialData={data} />;
}
