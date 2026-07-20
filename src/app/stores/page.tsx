/**
 * Public store-directory route.
 */

import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicStoreDirectory } from "@/lib/dashboard/server";
import { breadcrumbJsonLd, createPageMetadata } from "@/lib/seo";
import StoreDirectory from "@/views/StoreDirectory";

export const metadata: Metadata = createPageMetadata({
  title: "USDC Store Directory",
  description:
    "Discover independent stores accepting USDC through Outpay's direct, non-custodial checkout on Base.",
  path: "/stores",
  keywords: ["stores accepting USDC", "USDC merchants", "Base commerce"],
});

export const dynamic = "force-dynamic";

/**
 * Loads and renders active, opted-in stores for public discovery.
 */
export default async function StoresPage() {
  const directory = await getPublicStoreDirectory();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Store directory", path: "/stores" },
        ])}
      />
      <StoreDirectory initialStores={directory.stores} />
    </>
  );
}
