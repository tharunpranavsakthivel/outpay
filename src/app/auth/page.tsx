import { redirect } from "next/navigation";

/** Route: /auth - compatibility redirect to the Auth0-hosted login flow. */
export default function AuthPage() {
  redirect("/auth/login");
}
