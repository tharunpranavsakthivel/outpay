/**
 * XML sitemap for Outpay's public marketing and directory surfaces.
 *
 * The static marketing routes are always emitted. Public store profiles are
 * appended from the opt-in directory when the application database is
 * available; a temporary database failure leaves the valid static sitemap
 * intact rather than failing the crawler endpoint.
 */

import type { MetadataRoute } from "next";
import { getPublicStoreDirectory } from "@/lib/dashboard/server";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PUBLIC_ROUTES = [
  "/",
  "/product",
  "/product/checkout-links",
  "/product/merchant-dashboard",
  "/product/payment-detection",
  "/product/signed-webhooks",
  "/pricing",
  "/company",
  "/company/contact",
  "/developers/api-reference",
  "/developers/quickstart",
  "/developers/webhooks",
  "/changelog",
  "/stores",
  "/legal/terms",
  "/legal/privacy",
] as const;

/**
 * Generates the public sitemap and optionally discovers public store profiles.
 *
 * Parameters:
 * - None; the directory is read through the repository's public data loader.
 *
 * Returns:
 * - Sitemap entries for public pages only.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((path) => ({
    url: siteUrl(path),
    changeFrequency: path === "/changelog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" ? 0.9 : 0.7,
  }));

  try {
    const directory = await getPublicStoreDirectory({ limit: 100 });
    const storeEntries: MetadataRoute.Sitemap = directory.stores.map(
      (store) => ({
        url: siteUrl(`/stores/${encodeURIComponent(store.publicSlug)}`),
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );

    return [...staticEntries, ...storeEntries];
  } catch {
    return staticEntries;
  }
}
