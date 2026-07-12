import { withMerchantContext } from "@/lib/dashboard/route";
import { getStoreSettingsData } from "@/lib/dashboard/server";
import Settings from "../../views/Settings";

/** Route: /settings */
export default async function SettingsPage() {
  const data = await withMerchantContext(getStoreSettingsData, "/settings");
  return <Settings initialData={data} />;
}
