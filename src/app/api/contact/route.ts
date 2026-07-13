/**
 * Public enterprise contact submission route.
 *
 * Validates and rate-limits anonymous contact requests before inserting them
 * into `enterprise_contact_requests`; it never sends email or forwards user
 * input to an outbound messaging service.
 */

import { jsonError } from "@/lib/dashboard/http";
import { connectToDatabase } from "@/lib/database/client";
import { withRequestLogging } from "@/lib/logging/logger";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createJsonRateLimitError,
  getClientIp,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/http";
import { contactBodySchema } from "@/lib/validation/routes";

/**
 * Persists one validated anonymous enterprise contact request.
 *
 * Parameters:
 * - request: Web request containing the public contact form JSON payload.
 *
 * Returns:
 * - `201` after the row is created, or a structured validation, rate-limit,
 *   spam, or persistence error response.
 */
async function submitContactRequest(request: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      key: buildRateLimitKey({
        policy: RATE_LIMIT_POLICIES.contactSubmit,
        scopeType: "ip",
        scopeValue: getClientIp(request),
      }),
      policy: RATE_LIMIT_POLICIES.contactSubmit,
      routeId: "/api/contact POST",
    });

    if (!rateLimit.allowed) {
      return createJsonRateLimitError(
        RATE_LIMIT_POLICIES.contactSubmit,
        rateLimit.retryAfterSeconds,
      );
    }

    const parsedBody = await parseJsonBody(request, contactBodySchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    if (parsedBody.data.website !== "") {
      return jsonError(
        400,
        "SPAM_DETECTED",
        "Unable to submit this request. Please try again.",
      );
    }

    const database = await connectToDatabase();

    try {
      await database.sql`
        insert into enterprise_contact_requests (
          request_type,
          work_email,
          company_name,
          monthly_transaction_volume,
          message
        ) values (
          ${parsedBody.data.request_type},
          ${parsedBody.data.work_email},
          ${parsedBody.data.company_name},
          ${parsedBody.data.monthly_transaction_volume || null},
          ${parsedBody.data.message}
        )
      `;
    } finally {
      await database.release();
    }

    return Response.json({ submitted: true }, { status: 201 });
  } catch (error) {
    return jsonError(
      500,
      "CONTACT_SUBMISSION_FAILED",
      "Unable to submit your request. Please try again shortly.",
      undefined,
      error,
    );
  }
}

export const POST = withRequestLogging(
  "/api/contact POST",
  submitContactRequest,
);
