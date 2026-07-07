import { redirect } from "next/navigation";

/** Route: /login - compatibility redirect to the Auth0-hosted sign-in flow. */
export default function LoginPage() {
  redirect("/auth/login");
}
