import { redirect } from "next/navigation";
import {
  getFirstLoginPageData,
  MissingMerchantContextError,
} from "@/lib/dashboard/server";
import FirstLoginDashboard from "../../../views/FirstLoginDashboard";

/** Route: /dashboard/first-login — zero-state dashboard shown right after onboarding. */
export default async function FirstLoginDashboardPage() {
  try {
    const data = await getFirstLoginPageData();
    return <FirstLoginDashboard initialData={data} />;
  } catch (error) {
    if (error instanceof MissingMerchantContextError) {
      redirect("/onboarding");
    }

    throw error;
  }
}
