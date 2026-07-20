import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { SignupScreen } from "../../views/AuthScreens";

/** Route: /signup - first-party Better Auth email sign-up. */
export const metadata: Metadata = createPageMetadata({
  title: "Create an account",
  description: "Create an Outpay account to start accepting USDC on Base.",
  path: "/signup",
  noIndex: true,
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <SignupScreen returnTo={returnTo} />;
}
