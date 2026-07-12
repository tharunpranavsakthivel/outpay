import { withMerchantContext } from "@/lib/dashboard/route";
import { getAccountSettingsData } from "@/lib/dashboard/server";
import AccountSettings from "../../../views/AccountSettings";

/** Route: /settings/account */
export default async function AccountSettingsPage() {
  const data = await withMerchantContext(
    getAccountSettingsData,
    "/settings/account",
  );
  return <AccountSettings initialData={data} />;
}
