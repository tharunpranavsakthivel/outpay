import type { Metadata } from "next";
import { withMerchantContext } from "@/lib/dashboard/route";
import { getDevelopersPageData } from "@/lib/dashboard/server";
import { createPageMetadata } from "@/lib/seo";
import Developers from "../../views/Developers";

/** Route: /developers */
export const metadata: Metadata = createPageMetadata({
  title: "Developer Console",
  description:
    "Manage Outpay API keys, webhook endpoints, and delivery history.",
  path: "/developers",
  noIndex: true,
});

export default async function DevelopersPage() {
  const data = await withMerchantContext(getDevelopersPageData, "/developers");
  return <Developers initialData={data} />;
}
