import { getServerSession } from "@/lib/auth/server";
import Home from "../views/Home";

/** Route: / - marketing homepage with Better Auth-aware account actions. */
export default async function HomePage() {
  const session = await getServerSession();

  return (
    <Home
      authenticatedUser={
        session
          ? {
              email: session.user.email,
              name: session.user.name,
              picture: session.user.image ?? undefined,
            }
          : null
      }
    />
  );
}
