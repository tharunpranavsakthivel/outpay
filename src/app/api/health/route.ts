/**
 * Unauthenticated service health endpoint for Railway and uptime monitors.
 */

import { createHealthHandler } from "@/lib/health/check";
import { withRequestLogging } from "@/lib/logging/logger";

// This route intentionally has no auth guard; Railway needs to probe it before
// an authenticated application session exists. The proxy protects only the
// merchant UI prefixes, so `/api/health` remains reachable without cookies.
export const GET = withRequestLogging("/api/health GET", createHealthHandler());
