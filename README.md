# Outpay

Outpay is a Next.js 16 merchant checkout prototype for non-custodial USDC payments on Base.

The payment detection worker now depends on `REDIS_URL` and can be started with
`bun run worker:payments`.

The alert worker can be started with `bun run worker:alerts`. Set the optional
`OUTPAY_ALERT_WEBHOOK_URL` in `.env` to a Slack-compatible incoming webhook to
notify an operator about database connection failures, provider-down
transitions, webhook success rates below 95%, or queue jobs older than five
minutes. Structured logs use pino JSON output; `OUTPAY_LOG_LEVEL` controls the
minimum level.

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Copy the environment template and populate it with local values:

```bash
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` to a high-entropy value and keep
`BETTER_AUTH_URL` aligned with your local app origin. Checkout expiry defaults
to 30 minutes with a 10 minute detected-payment grace window; override
`OUTPAY_CHECKOUT_TTL_SECONDS` or `OUTPAY_CHECKOUT_DETECTED_GRACE_SECONDS` in
`.env` when you need shorter local test cycles.

3. Start the app:

```bash
bun run dev
```

Open `http://localhost:3000` after the server starts.

## Database setup

The database tooling resolves connections in this order using the variable names defined in `.env.example`:

1. `DATABASE_URL`
2. `DATABASE_PUBLIC_URL`
3. `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`

Run the schema migrations on a clean PostgreSQL database with:

```bash
bun run db:migrate
```

Inspect migration status with:

```bash
bun run db:status
```

Validate that the required schema objects were created with:

```bash
bun run db:validate
```

Roll back the most recent migration with:

```bash
bun run db:migrate:down
```

## Database assumptions

- `DATABASE_SCHEMA.md` is the source of truth for the initial schema.
- `auth.users` is required by the schema. On Supabase, the existing auth table is used as-is.
- On a plain PostgreSQL database, the first migration creates a minimal `auth.users` compatibility table so the documented foreign keys can be created from scratch.
- Better Auth adds its own auth tables in the next migration while mirroring core profile data into `auth.users` and `user_profiles`.
- The schema migration does not seed pricing plans, blockchains, or tokens because this task is limited to structure creation.

## Quality checks

Run the formatter and linter with:

```bash
bun run format
bun run lint
```
