import { auth0 } from "@/lib/auth0";
import Home from "../views/Home";

/** Route: / - marketing homepage with Auth0-aware account actions. */
export default async function HomePage() {
  const session = await auth0.getSession();

  return (
    <Home
      authenticatedUser={
        session
          ? {
              email: session.user.email,
              name: session.user.name,
              picture: session.user.picture,
            }
          : null
      }
    />
  );
}
