/**
 * Admin dashboard entry point. The shared admin layout performs authorization
 * before this redirect is evaluated.
 */

import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/payments");
}
