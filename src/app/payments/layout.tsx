/**
 * No-index metadata boundary for the authenticated payments route.
 */

import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Payments | Outpay Merchant Dashboard",
  description: "Review merchant payment activity in the Outpay dashboard.",
  path: "/payments",
  noIndex: true,
});

/**
 * Renders authenticated payment management content.
 *
 * Parameters:
 * - children: Payment route content.
 *
 * Returns:
 * - The unchanged payment content tree.
 */
export default function PaymentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
