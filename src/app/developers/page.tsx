import { withMerchantContext } from "@/lib/dashboard/route";
import { getDevelopersPageData } from "@/lib/dashboard/server";
import Developers from "../../views/Developers";

/** Route: /developers */
export default async function DevelopersPage() {
  const data = await withMerchantContext(getDevelopersPageData, "/developers");
  return <Developers initialData={data} />;
}
