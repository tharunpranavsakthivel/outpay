import { redirect } from "next/navigation";

/** Route: /auth - compatibility redirect to the first-party login screen. */
export default function AuthPage() {
  redirect("/login");
}
