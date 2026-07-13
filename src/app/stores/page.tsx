/**
 * Public store-directory route.
 */

import type { Metadata } from "next";
import { getPublicStoreDirectory } from "@/lib/dashboard/server";
import StoreDirectory from "@/views/StoreDirectory";

export const metadata: Metadata = {
  title: "Store directory | Outpay",
  description: "Discover stores accepting USDC through Outpay.",
};

export const dynamic = "force-dynamic";

/**
 * Loads and renders active, opted-in stores for public discovery.
 */
export default async function StoresPage() {
  const directory = await getPublicStoreDirectory();
  return <StoreDirectory initialStores={directory.stores} />;
}
