import { redirect } from "next/navigation";
import {
  getDashboardPageData,
  MissingMerchantContextError,
} from "@/lib/dashboard/server";
import MerchantDashboard from "../../views/MerchantDashboard";

/** Route: /dashboard */
export default async function DashboardPage() {
  try {
    const data = await getDashboardPageData();
    return <MerchantDashboard initialData={data} />;
  } catch (error) {
    if (error instanceof MissingMerchantContextError) {
      redirect("/onboarding");
    }

    throw error;
  }
}
