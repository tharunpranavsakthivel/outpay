/**
 * Shared dashboard sidebar nav model. Every merchant-app screen (Dashboard,
 * Checkouts, Payments, Developers, Settings) uses this same 5-item nav,
 * kept in one place so active-state styling stays
 * consistent across screens.
 */
export type NavId =
  | "dashboard"
  | "checkouts"
  | "payments"
  | "developers"
  | "settings";

export const NAV_ITEMS: { id: NavId; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "checkouts", label: "Checkouts", href: "/checkouts" },
  { id: "payments", label: "Payments", href: "/payments" },
  { id: "developers", label: "Developers", href: "/developers" },
  { id: "settings", label: "Settings", href: "/settings" },
];
