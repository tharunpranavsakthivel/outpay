/**
 * Better Auth server configuration for Outpay.
 *
 * This module owns the Next.js auth handler, Postgres-backed Better Auth
 * database adapter, and the compatibility hooks that keep the existing
 * `auth.users` and `user_profiles` tables aligned with Better Auth users.
 */

import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { connectToDatabase } from "@/lib/database/client";
import {
  getAuthPoolMax,
  getPrimaryDatabaseConnectionCandidate,
} from "@/lib/database/config";
import { sendResetPasswordEmail } from "@/lib/email/send";
import { logger } from "@/lib/logging/logger";

const AUTH_BASE_URL =
  process.env.BETTER_AUTH_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  "http://localhost:3000";
const AUTH_ORIGIN = new URL(AUTH_BASE_URL).origin;

const AUTH_SECRET = process.env.BETTER_AUTH_SECRET?.trim();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

// Railway's public edge forwards the client address in X-Real-IP. Keep the
// standard X-Forwarded-For fallback for local reverse proxies, but do not
// configure a broad trusted-proxy range: Better Auth safely validates a
// single-value header without one, while an unbounded proxy range would allow
// callers to influence their own rate-limit bucket.
const BETTER_AUTH_IP_ADDRESS_HEADERS = ["x-real-ip", "x-forwarded-for"];

if (!AUTH_SECRET) {
  throw new Error(
    "Better Auth secret is missing. Set BETTER_AUTH_SECRET in your environment.",
  );
}

const authPool = new Pool({
  connectionString: getPrimaryDatabaseConnectionCandidate().url,
  max: getAuthPoolMax(),
});

const authDatabase = new Kysely({
  dialect: new PostgresDialect({
    pool: authPool,
  }),
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalizes user emails before comparing them against the app-owned profile
 * records.
 *
 * Parameters:
 * - email: Raw email address from Better Auth.
 *
 * Returns:
 * - Lower-cased email used for stable lookups.
 */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a Better Auth additional-field value before mirroring it to the
 * application profile table.
 *
 * Parameters:
 * - value: Date or ISO string returned by the Better Auth adapter.
 *
 * Returns:
 * - Valid Date instance, or `null` for an absent or invalid value.
 */
function normalizeLegalAcceptanceTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Converts a Better Auth text user ID into a deterministic UUID for the
 * UUID-based merchant schema compatibility layer.
 *
 * Parameters:
 * - authUserId: Better Auth user ID.
 *
 * Returns:
 * - Existing UUID when the ID is already UUID-shaped.
 * - Stable derived UUID when Better Auth generated an opaque text identifier.
 */
function getCompatibilityProfileUuid(authUserId: string) {
  if (UUID_PATTERN.test(authUserId)) {
    return authUserId.toLowerCase();
  }

  const digest = createHash("sha256")
    .update(`outpay-better-auth:${authUserId}`)
    .digest("hex");
  const bytes = digest.slice(0, 32).split("");

  bytes[12] = "5";
  bytes[16] = ((Number.parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);

  return [
    bytes.slice(0, 8).join(""),
    bytes.slice(8, 12).join(""),
    bytes.slice(12, 16).join(""),
    bytes.slice(16, 20).join(""),
    bytes.slice(20, 32).join(""),
  ].join("-");
}

/**
 * Reuses an existing merchant-profile UUID when the email is already linked,
 * otherwise derives a stable UUID from the Better Auth text identifier.
 *
 * Parameters:
 * - email: Better Auth user email.
 * - userId: Better Auth user ID.
 *
 * Returns:
 * - UUID used by the legacy app tables.
 */
async function resolveProfileUuid(params: {
  email: string;
  userId: string;
}): Promise<string> {
  const database = await connectToDatabase();

  try {
    const normalizedEmail = normalizeEmail(params.email);
    const existingRows = await database.sql<{ id: string }[]>`
      select id::text as id
      from user_profiles
      where lower(email::text) = ${normalizedEmail}
      limit 1
    `;

    if (existingRows[0]?.id) {
      return existingRows[0].id;
    }

    return getCompatibilityProfileUuid(params.userId);
  } finally {
    await database.release();
  }
}

/**
 * Loads the Better Auth user record needed to repair or update the UUID-based
 * compatibility tables on sign-in.
 *
 * Parameters:
 * - userId: Better Auth user ID.
 *
 * Returns:
 * - Minimal Better Auth user data when found.
 * - `null` when the auth row no longer exists.
 */
async function getAuthUserRecord(userId: string): Promise<{
  email: string;
  image: string | null;
  name: string;
  privacyAcceptedAt: Date | null;
  termsAcceptedAt: Date | null;
  userId: string;
} | null> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<
      {
        email: string;
        image: string | null;
        name: string;
        privacy_accepted_at: Date | null;
        terms_accepted_at: Date | null;
        user_id: string;
      }[]
    >`
      select
        email,
        image,
        name,
        "privacy_accepted_at" as privacy_accepted_at,
        "terms_accepted_at" as terms_accepted_at,
        id as user_id
      from "user"
      where id = ${userId}
      limit 1
    `;

    return rows[0]
      ? {
          email: rows[0].email,
          image: rows[0].image,
          name: rows[0].name,
          privacyAcceptedAt: rows[0].privacy_accepted_at,
          termsAcceptedAt: rows[0].terms_accepted_at,
          userId: rows[0].user_id,
        }
      : null;
  } finally {
    await database.release();
  }
}

/**
 * Mirrors Better Auth users into the legacy auth compatibility tables that the
 * existing merchant schema already references.
 *
 * Parameters:
 * - userId: Better Auth user ID.
 * - email: Primary user email address.
 * - name: Human-readable display name stored in `user_profiles.full_name`.
 * - image: Optional avatar URL stored in `user_profiles.avatar_url`.
 */
async function upsertProfileCompatibilityRecord(params: {
  email: string;
  image: string | null | undefined;
  name: string;
  privacyAcceptedAt?: Date | null;
  termsAcceptedAt?: Date | null;
  userId: string;
}): Promise<void> {
  const profileUuid = await resolveProfileUuid({
    email: params.email,
    userId: params.userId,
  });
  const database = await connectToDatabase();

  try {
    await database.sql`
      insert into auth.users (id)
      values (${profileUuid}::uuid)
      on conflict (id) do nothing
    `;

    await database.sql`
      insert into user_profiles (
        id,
        email,
        full_name,
        avatar_url,
        privacy_accepted_at,
        terms_accepted_at,
        updated_at
      )
      values (
        ${profileUuid}::uuid,
        ${normalizeEmail(params.email)},
        ${params.name},
        ${params.image ?? null},
        ${params.privacyAcceptedAt ?? null},
        ${params.termsAcceptedAt ?? null},
        now()
      )
      on conflict (id) do update
      set
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        privacy_accepted_at = coalesce(
          excluded.privacy_accepted_at,
          user_profiles.privacy_accepted_at
        ),
        terms_accepted_at = coalesce(
          excluded.terms_accepted_at,
          user_profiles.terms_accepted_at
        ),
        updated_at = now()
    `;
  } finally {
    await database.release();
  }
}

/**
 * Records the latest successful Better Auth session start in `user_profiles`.
 *
 * Parameters:
 * - userId: Better Auth user ID.
 */
async function markLastLogin(userId: string): Promise<void> {
  const authUser = await getAuthUserRecord(userId);

  if (!authUser) {
    return;
  }

  await upsertProfileCompatibilityRecord(authUser);
  const profileUuid = await resolveProfileUuid({
    email: authUser.email,
    userId: authUser.userId,
  });
  const database = await connectToDatabase();

  try {
    await database.sql`
      update user_profiles
      set
        last_login_at = now(),
        updated_at = now()
      where id = ${profileUuid}::uuid
    `;
  } finally {
    await database.release();
  }
}

export const auth = betterAuth({
  advanced: {
    ipAddress: {
      ipAddressHeaders: BETTER_AUTH_IP_ADDRESS_HEADERS,
    },
  },
  baseURL: AUTH_BASE_URL,
  database: {
    db: authDatabase,
    generateId: "uuid",
    type: "postgres",
  },
  user: {
    additionalFields: {
      privacyAcceptedAt: {
        fieldName: "privacy_accepted_at",
        input: true,
        required: false,
        returned: false,
        type: "date",
      },
      termsAcceptedAt: {
        fieldName: "terms_accepted_at",
        input: true,
        required: false,
        returned: false,
        type: "date",
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await markLastLogin(session.userId);
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          await upsertProfileCompatibilityRecord({
            email: user.email,
            image: user.image,
            name: user.name,
            privacyAcceptedAt: normalizeLegalAcceptanceTimestamp(
              user.privacyAcceptedAt,
            ),
            termsAcceptedAt: normalizeLegalAcceptanceTimestamp(
              user.termsAcceptedAt,
            ),
            userId: user.id,
          });
        },
      },
      update: {
        after: async (user) => {
          await upsertProfileCompatibilityRecord({
            email: user.email,
            image: user.image,
            name: user.name,
            userId: user.id,
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendResetPasswordEmail({
          email: user.email,
          name: user.name,
          url,
        });
      } catch (error) {
        // Better Auth keeps the response generic for unknown and known emails;
        // preserve that contract while recording delivery failures for ops.
        logger.error({ err: error }, "Password reset email delivery failed");
        throw error;
      }
    },
  },
  plugins: [nextCookies()],
  secret: AUTH_SECRET,
  socialProviders:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  trustedOrigins: [AUTH_ORIGIN],
});
