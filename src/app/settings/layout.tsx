/**
 * No-index metadata boundary for authenticated merchant settings routes.
 */

import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Settings | Outpay Merchant Dashboard",
  description: "Manage Outpay merchant profile, wallet, and webhook settings.",
  path: "/settings",
  noIndex: true,
});

/**
 * Renders authenticated settings content.
 *
 * Parameters:
 * - children: Settings route content.
 *
 * Returns:
 * - The unchanged settings content tree.
 */
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
