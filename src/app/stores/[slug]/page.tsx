/**
 * Public route for one active, opted-in store profile.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicStoreProfile } from "@/lib/dashboard/server";
import { breadcrumbJsonLd, createPageMetadata, siteUrl } from "@/lib/seo";
import StoreProfile from "@/views/StoreProfile";

const getCachedStoreProfile = cache((slug: string) =>
  getPublicStoreProfile(slug),
);

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
  const store = await getCachedStoreProfile(slug);
  const path = `/stores/${encodeURIComponent(slug)}`;

  return store
    ? createPageMetadata({
        description:
          store.directorySummary ??
          `${store.displayName} accepts USDC through Outpay on Base.`,
        title: `${store.displayName} | Store directory`,
        path,
        keywords: [
          `${store.displayName} USDC`,
          "stores accepting USDC",
          "Base commerce",
        ],
        image: store.logoUrl ?? undefined,
      })
    : createPageMetadata({
        description: "The requested public Outpay store profile was not found.",
        title: "Store not found",
        path,
        noIndex: true,
      });
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
  const store = await getCachedStoreProfile(slug);

  if (!store) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Store directory", path: "/stores" },
          {
            name: store.displayName,
            path: `/stores/${encodeURIComponent(slug)}`,
          },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: store.displayName,
          url:
            store.websiteUrl ?? siteUrl(`/stores/${encodeURIComponent(slug)}`),
          logo: store.logoUrl ?? undefined,
          description:
            store.directorySummary ??
            `${store.displayName} accepts USDC through Outpay on Base.`,
        }}
      />
      <StoreProfile store={store} />
    </>
  );
}
