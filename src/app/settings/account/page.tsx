import { getAccountSettingsData } from "@/lib/dashboard/server";
import AccountSettings from "../../../views/AccountSettings";

/** Route: /settings/account */
export default async function AccountSettingsPage() {
  const data = await getAccountSettingsData();
  return <AccountSettings initialData={data} />;
}
