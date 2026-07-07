import { getDashboardPageData } from "@/lib/dashboard/server";
import MerchantDashboard from "../../views/MerchantDashboard";

/** Route: /dashboard */
export default async function DashboardPage() {
  const data = await getDashboardPageData();
  return <MerchantDashboard initialData={data} />;
}
