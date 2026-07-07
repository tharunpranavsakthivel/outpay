import { redirect } from "next/navigation";

/** Route: /signup - compatibility redirect to the Auth0-hosted signup flow. */
export default function SignupPage() {
  redirect("/auth/login?screen_hint=signup");
}
