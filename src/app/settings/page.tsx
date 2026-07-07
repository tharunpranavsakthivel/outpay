import { getStoreSettingsData } from "@/lib/dashboard/server";
import Settings from "../../views/Settings";

/** Route: /settings */
export default async function SettingsPage() {
  const data = await getStoreSettingsData();
  return <Settings initialData={data} />;
}
