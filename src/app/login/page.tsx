import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { LoginScreen } from "../../views/AuthScreens";

/** Route: /login - first-party Better Auth email sign-in. */
export const metadata: Metadata = createPageMetadata({
  title: "Log in",
  description:
    "Log in to manage Outpay USDC checkouts, payments, and webhooks.",
  path: "/login",
  noIndex: true,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginScreen returnTo={returnTo} />;
}
