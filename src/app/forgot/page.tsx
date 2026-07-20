import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { ForgotPasswordScreen } from "../../views/AuthScreens";

/** Route: /forgot - password reset request page. */
export const metadata: Metadata = createPageMetadata({
  title: "Reset your password",
  description: "Request a secure Outpay password reset link.",
  path: "/forgot",
  noIndex: true,
});

export default ForgotPasswordScreen;
