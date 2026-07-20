/**
 * Search crawler policy for the Outpay App Router.
 *
 * Public marketing and opted-in store pages remain crawlable, while account,
 * operational, API, ephemeral checkout, and dashboard routes stay out of the
 * index. Public developer detail pages are explicitly allowed beneath the
 * protected `/developers` dashboard route.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Returns the generated robots.txt policy.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - Next.js MetadataRoute.Robots with crawl rules and the sitemap location.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/developers/api-reference",
        "/developers/quickstart",
        "/developers/webhooks",
      ],
      disallow: [
        "/admin/",
        "/api/",
        "/dashboard/",
        "/checkouts/",
        "/payments/",
        "/settings/",
        "/onboarding",
        "/login",
        "/signup",
        "/forgot",
        "/auth",
        "/checkout/",
        "/receipt/",
        "/developers",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
