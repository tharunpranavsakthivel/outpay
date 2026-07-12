import { withMerchantContext } from "@/lib/dashboard/route";
import { getFirstLoginPageData } from "@/lib/dashboard/server";
import FirstLoginDashboard from "../../../views/FirstLoginDashboard";

/** Route: /dashboard/first-login — zero-state dashboard shown right after onboarding. */
export default async function FirstLoginDashboardPage() {
  const data = await withMerchantContext(
    getFirstLoginPageData,
    "/dashboard/first-login",
  );
  return <FirstLoginDashboard initialData={data} />;
}
