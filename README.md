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

Open `http://localhost:3001` after the server starts.

## Tigris/S3 logo storage

Merchant store-logo uploads use Tigris, an S3-compatible object-storage
provider. Create a bucket in the [Tigris console](https://console.storage.dev/)
and set these values in `.env` (the same variables are listed in
`.env.example`):

```dotenv
AWS_ACCESS_KEY_ID=your-tigris-access-key-id
AWS_SECRET_ACCESS_KEY=your-tigris-secret-access-key
AWS_ENDPOINT_URL_S3=https://t3.storage.dev
AWS_ENDPOINT_URL_IAM=https://iam.storage.dev
AWS_REGION=auto
TIGRIS_BUCKET_NAME=your-bucket-name
```

The app requires `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_ENDPOINT_URL_S3`, and `TIGRIS_BUCKET_NAME` for logo upload and retrieval.
Keep the access and secret keys private.

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

To inspect the tables and row counts that would be cleared, run the dry run:

```bash
bun run db:clear
```

> **Destructive operation:** `bun run db:clear -- --execute` truncates the
> application tables in the `auth` and `public` schemas with
> `RESTART IDENTITY CASCADE`. It requires typing the exact database name and
> does not include `public.schema_migrations` unless
> `--include-migrations` is also supplied. Never run it against a production
> database unless you have explicitly reviewed the target and accepted the
> data-loss risk.

Roll back the most recent migration with:

```bash
bun run db:migrate:down
```

## Database assumptions

- `DATABASE_SCHEMA.md` is the source of truth for the initial schema.
- `auth.users` is required by the schema. On Supabase, the existing auth table is used as-is.
- On a plain PostgreSQL database, the first migration creates a minimal `auth.users` compatibility table so the documented foreign keys can be created from scratch.
- Better Auth adds its own auth tables in the next migration while mirroring core profile data into `auth.users` and `user_profiles`.
- Migration `0012_usage_metering_billing` seeds the `free`, `standard_usage`, and `corporate` pricing plans. Confirmed paid payments update monthly usage and create usage-fee ledger entries after the allowance.

## Known limitations

- The payment-verification pipeline is still undergoing audit remediation.
  Queue, provider, reconciliation, and merchant-webhook workers exist, but the
  production-readiness gap is not fully closed. Use `ARCHITECTURE.md` and the
  latest production-readiness audit as the target-state and remediation
  references before treating payment processing as production-ready.
- The `OUTPAY_SECRET_KEY`, `OUTPAY_TEST_SECRET_KEY`, `OUTPAY_LIVE_SECRET_KEY`,
  `OUTPAY_PUBLIC_KEY`, and `OUTPAY_WEBHOOK_SIGNING_SECRET` values in
  `.env.example` are reserved placeholders and are not consumed by the current
  application. They are not usable integration credentials until T-14 ships.

## Quality checks

Run the Vitest unit and integration-adjacent suites with:

```bash
bun run test
```

Use watch mode during development:

```bash
bun run test:watch
```

Run the Playwright browser smoke suite (the local app is started on port 3001):

```bash
bun run test:e2e
```

For integration tests that need a real PostgreSQL schema, start the disposable
test database first. It uses only the local fixture credentials from
`docker-compose.test.yml`, stores data in tmpfs, and is removed with `down -v`:

```bash
bun run test:db:up
DATABASE_URL=postgresql://outpay_test:outpay_test_password@127.0.0.1:55432/outpay_test bun run db:migrate
bun run test:db:down
```

Never point this workflow at `DATABASE_URL`, `DATABASE_PUBLIC_URL`, Railway,
or any production database. See `docs/adr/001-test-framework.md` for the
runner and migration-test decisions.

Run the formatter and linter with:

```bash
bun run format
bun run lint
```
