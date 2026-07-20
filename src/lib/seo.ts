/**
 * Shared SEO configuration and JSON-LD builders for the Outpay App Router.
 *
 * Exports canonical site constants, route metadata helpers, and structured-data
 * builders used by public pages. It has no runtime side effects beyond reading
 * APP_BASE_URL when metadata is evaluated during a server render or build.
 */

import type { Metadata } from "next";

export const SITE_NAME = "Outpay";
export const SITE_URL = resolveSiteUrl();
export const DEFAULT_DESCRIPTION =
  "Non-custodial USDC checkout on Base for merchants and developers building stablecoin payment flows.";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export type SeoPageOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  image?: string;
};

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Builds an absolute, origin-only site URL from the configured app origin.
 *
 * Parameters:
 * - None; APP_BASE_URL is read from the server environment.
 *
 * Returns:
 * - A valid origin suitable for canonical URLs and sitemap entries.
 *
 * Edge cases:
 * - Invalid or missing configuration falls back to the documented production
 *   domain so generated metadata never contains a malformed URL.
 */
function resolveSiteUrl(): string {
  const configuredUrl = process.env.APP_BASE_URL?.trim();

  if (configuredUrl) {
    try {
      const origin = new URL(configuredUrl).origin;
      const isLocalOrigin = ["localhost", "127.0.0.1", "::1"].some((host) =>
        origin.includes(`://${host}`),
      );

      return process.env.NODE_ENV === "production" && isLocalOrigin
        ? "https://outpay.tech"
        : origin;
    } catch {
      // Metadata should remain valid even when a local environment has a typo.
    }
  }

  return "https://outpay.tech";
}

/**
 * Returns an absolute URL for a route on the configured Outpay origin.
 *
 * Parameters:
 * - path: Absolute site path such as `/pricing`.
 *
 * Returns:
 * - Absolute URL string used by canonical links and structured data.
 */
export function siteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Creates complete metadata for a public or private route.
 *
 * Parameters:
 * - options: Title, description, canonical path, optional keywords, indexing
 *   policy, and social image.
 *
 * Returns:
 * - Next.js Metadata with canonical, Open Graph, Twitter, and robots fields.
 */
export function createPageMetadata(options: SeoPageOptions): Metadata {
  const canonicalUrl = siteUrl(options.path);
  const imageUrl = options.image ?? DEFAULT_OG_IMAGE;
  const robots = options.noIndex
    ? {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      };

  return {
    title: options.title,
    description: options.description,
    keywords: options.keywords,
    alternates: { canonical: canonicalUrl },
    robots,
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: options.title,
      description: options.description,
      locale: "en_US",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${options.title} — ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [imageUrl],
    },
  };
}

/**
 * Builds Organization structured data for the site-wide identity graph.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - Schema.org Organization JSON-LD data.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: siteUrl("/logo/light-32.png"),
    description: DEFAULT_DESCRIPTION,
  };
}

/**
 * Builds SoftwareApplication structured data for Outpay's web application.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - Schema.org SoftwareApplication JSON-LD data with the documented starting
 *   price and supported web platform.
 */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "The first 1,000 paid transactions each month are free.",
      url: siteUrl("/pricing"),
    },
  };
}

/**
 * Builds BreadcrumbList structured data for a public route.
 *
 * Parameters:
 * - items: Ordered breadcrumb labels and site paths, including Home when
 *   desired by the caller.
 *
 * Returns:
 * - Schema.org BreadcrumbList JSON-LD data.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

/**
 * Builds Product structured data for the main Outpay product page.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - Schema.org Product JSON-LD data without fabricated ratings or reviews.
 */
export function productJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Outpay stablecoin checkout",
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    category: "Stablecoin payment software",
    url: siteUrl("/product"),
    image: siteUrl(DEFAULT_OG_IMAGE),
    description:
      "A non-custodial checkout and payment-verification platform for accepting USDC on Base.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: siteUrl("/pricing"),
      description: "Start with the monthly free transaction allowance.",
    },
  };
}

/**
 * Builds FAQPage structured data from questions visibly rendered on a page.
 *
 * Parameters:
 * - items: FAQ questions and answers that exactly match the page content.
 *
 * Returns:
 * - Schema.org FAQPage JSON-LD data.
 */
export function faqPageJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
