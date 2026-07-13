/**
 * Public route for one active, opted-in store profile.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicStoreProfile } from "@/lib/dashboard/server";
import StoreProfile from "@/views/StoreProfile";

export const dynamic = "force-dynamic";

/**
 * Loads metadata only after confirming the public store exists.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStoreProfile(slug);

  return store
    ? {
        description:
          store.directorySummary ??
          `${store.displayName} accepts USDC through Outpay.`,
        title: `${store.displayName} | Outpay store directory`,
      }
    : { title: "Store not found | Outpay" };
}

/**
 * Renders the public profile for a directory-listed store.
 */
export default async function StoreProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getPublicStoreProfile(slug);

  if (!store) {
    notFound();
  }

  return <StoreProfile store={store} />;
}
