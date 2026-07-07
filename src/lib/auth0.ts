import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Server-side Auth0 SDK client.
 *
 * Exposes Auth0 session, middleware, login, callback, and logout handling for
 * Next.js App Router routes. Configuration is loaded from AUTH0_* environment
 * variables and APP_BASE_URL.
 */
export const auth0 = new Auth0Client();
