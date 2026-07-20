/**
 * No-index metadata boundary for authenticated merchant dashboard routes.
 * The dashboard is operational account content, not a public landing page.
 */

import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Merchant Dashboard | Outpay",
  description: "Manage your Outpay merchant account and USDC payment activity.",
  path: "/dashboard",
  noIndex: true,
});

/**
 * Renders the authenticated dashboard segment without changing its layout.
 *
 * Parameters:
 * - children: Dashboard route content.
 *
 * Returns:
 * - The unchanged dashboard content tree.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
