/**
 * Better Auth cookie names used by optimistic route protection in `proxy.ts`.
 *
 * The secure-prefixed variant is included so production deployments that emit
 * `__Secure-` cookies still pass the same lightweight proxy check.
 */

export const BETTER_AUTH_SESSION_COOKIE_NAME = "better-auth.session_token";
export const BETTER_AUTH_SECURE_SESSION_COOKIE_NAME =
  "__Secure-better-auth.session_token";
