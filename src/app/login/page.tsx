import { LoginScreen } from "../../views/AuthScreens";

/** Route: /login - first-party Better Auth email sign-in. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginScreen returnTo={returnTo} />;
}
