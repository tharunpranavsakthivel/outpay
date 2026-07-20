/**
 * No-index metadata boundary for authenticated checkout management routes.
 */

import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Checkout Management | Outpay",
  description: "Manage hosted USDC checkouts in the Outpay merchant dashboard.",
  path: "/checkouts",
  noIndex: true,
});

/**
 * Renders authenticated checkout management content.
 *
 * Parameters:
 * - children: Checkout management route content.
 *
 * Returns:
 * - The unchanged checkout management content tree.
 */
export default function CheckoutsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
