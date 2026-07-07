import { SignupScreen } from "../../views/AuthScreens";

/** Route: /signup - first-party Better Auth email sign-up. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <SignupScreen returnTo={returnTo} />;
}
