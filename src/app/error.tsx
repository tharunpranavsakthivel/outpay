"use client";

import Error500 from "../views/Error500";

/**
 * Next.js App Router special file — auto-rendered for uncaught errors in
 * this route segment (and below). Must be a Client Component. Receives
 * `error` and `reset()` — `reset()` re-renders the segment; wire it into
 * Error500's retry button if you want the "Try again" action to actually
 * retry the render instead of just simulating a delay.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Wire `reset` into Error500's "Try again" button (e.g. via an onRetry prop)
  // if you want it to actually re-render the segment instead of a simulated delay.
  void error;
  void reset;
  return <Error500 />;
}
