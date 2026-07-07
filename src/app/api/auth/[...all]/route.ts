/**
 * Better Auth catch-all route handler mounted at `/api/auth/*`.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { DELETE, GET, PATCH, POST, PUT } = toNextJsHandler(auth);
