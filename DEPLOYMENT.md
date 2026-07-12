# Railway deployment

This document defines the production Railway topology for Outpay. The repository
uses one Bun-based Docker image and separate Railway services with different start
commands. No database migration is run by the container entrypoint; apply migrations
as an explicit release operation before starting the services.

## Service topology

Create all services in the same Railway project and environment:

| Service | Config as Code file | Start command | Public access |
| --- | --- | --- | --- |
| `outpay-web` | `/railway.json` | `bun run start` | Public domain only service |
| `outpay-payment-worker` | `/railway.payment-worker.json` | `bun run worker:payments` | No domain |
| `outpay-reconciler` | `/railway.reconciler.json` | `bun run worker:reconciler` | No domain |
| `outpay-webhook-worker` | `/railway.webhook-worker.json` | `bun run worker:webhooks` | No domain |
| `Postgres` | Railway PostgreSQL add-on | Railway-managed | No public endpoint |
| `Redis` | Railway Redis add-on | Railway-managed | No public endpoint |

The `worker:health` script is an operational alias for
`bun workers/provider-health.ts`. It is not a fifth required service in this
topology. Run it as a separate private service only when provider-health alert
monitoring is being operated independently.

### Applying the per-service configuration

Railway config-as-code is resolved per deployment. The web service uses the default
`/railway.json`. For each worker, open Service Settings and set its custom Config as
Code path to the absolute repository path shown in the table above. Keep the service
Root Directory at `/` so the Dockerfile and workspace lockfile are available.

The shared [Dockerfile](/Users/tp/Desktop/Adelecte/outpay/Dockerfile) installs the
locked Bun dependencies and builds Next.js once for every service image. Railway's
per-service start command selects the long-running process; do not replace a worker
command with `bun run start`.

## Variables

Set these variables on every application service. Prefer Railway reference variables
to copied credentials:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
OUTPAY_DATABASE_POOL_MAX=5
OUTPAY_LOG_LEVEL=info
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

Use the actual Railway service names in the reference expressions if the add-ons are
renamed. Do not use `DATABASE_PUBLIC_URL`, a Postgres TCP proxy URL, or a Redis TCP
proxy URL for application-to-database traffic.

### `outpay-web`

Required application variables:

- `DATABASE_URL`, `REDIS_URL`, `OUTPAY_DATABASE_POOL_MAX`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_BASE_URL`
- `OUTPAY_AUTH_POOL_MAX`
- `ALCHEMY_BASE_RPC_URL`, `ALCHEMY_WEBHOOK_SIGNING_KEY`
- `ALCHEMY_NOTIFY_WEBHOOK_ID`, `ALCHEMY_NOTIFY_API_BASE_URL`
- `CHAINSTACK_BASE_RPC_URL`
- `MERCHANT_WEBHOOK_SECRET_ENCRYPTION_KEY`
- `RESEND_API_KEY`, `OUTPAY_EMAIL_FROM`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`,
  `AWS_REGION`, `TIGRIS_BUCKET_NAME`

Set `OUTPAY_EMAIL_REPLY_TO` and `OUTPAY_ALERT_WEBHOOK_URL` when those optional
integrations are enabled. The public provider webhook route is
`/api/internal/provider-webhooks/alchemy`; its signature key must be present before
registering the provider webhook.

The web config enables Railway's deployment health check at `GET /api/health` with a
30-second timeout. This endpoint is intentionally unauthenticated and returns HTTP
503 when PostgreSQL is unavailable.

### `outpay-payment-worker`

Required:

- `DATABASE_URL`, `REDIS_URL`, `OUTPAY_DATABASE_POOL_MAX`
- `OUTPAY_USDC_SLIGHT_OVERPAY_TOLERANCE`

Optional tuning:

- `OUTPAY_WORKER_CONCURRENCY`
- `OUTPAY_LOG_LEVEL`

### `outpay-reconciler`

Required:

- `DATABASE_URL`, `REDIS_URL`, `OUTPAY_DATABASE_POOL_MAX`
- `ALCHEMY_BASE_RPC_URL`, `CHAINSTACK_BASE_RPC_URL`
- `RPC_PRIMARY_PROVIDER`, `RPC_SECONDARY_PROVIDER`, `RPC_TIMEOUT_MS`,
  `RPC_FAILOVER_ENABLED`

Optional scan tuning uses the `RECONCILER_*` variables in `.env.example`:
`RECONCILER_RECENT_WINDOW_BLOCKS`, `RECONCILER_DEEP_WINDOW_BLOCKS`,
`RECONCILER_RECENT_INTERVAL_MS`, `RECONCILER_CONFIRMATION_INTERVAL_MS`,
`RECONCILER_DEEP_INTERVAL_MS`, and `RECONCILER_CONFIRMATION_BATCH_SIZE`.

### `outpay-webhook-worker`

Required:

- `DATABASE_URL`, `REDIS_URL`, `OUTPAY_DATABASE_POOL_MAX`
- `MERCHANT_WEBHOOK_SECRET_ENCRYPTION_KEY`

Optional tuning:

- `OUTPAY_WEBHOOK_WORKER_CONCURRENCY`
- `OUTPAY_LOG_LEVEL`

The worker only processes queued merchant deliveries. It does not need a public
Railway domain.

## Private networking and exposure

Railway private networking is scoped to services in the same project and environment.
Configure the following in the Railway dashboard:

1. Add the PostgreSQL and Redis services to the same project and environment as the
   four application services.
2. Create `DATABASE_URL` and `REDIS_URL` reference variables on each application
   service, pointing to the add-ons' private connection variables.
3. Do not generate a public domain for any worker.
4. Disable the Postgres and Redis public TCP proxy/external access if enabled by the
   add-on, and verify that only their private connection variables are used.
5. Generate a public domain only for `outpay-web`. Route the custom web hostname to
   that service; never route a hostname to a worker, Postgres, or Redis.
6. Keep `DATABASE_PUBLIC_URL` unset on deployed application services. The database
   resolver prefers `DATABASE_URL`, which must be the private Railway connection.

The intended network is:

```text
outpay-web              --private--> Postgres, Redis
outpay-payment-worker   --private--> Postgres, Redis
outpay-reconciler       --private--> Postgres, Redis
outpay-webhook-worker   --private--> Postgres, Redis
```

Only the web service's public HTTP domain is exposed. Railway's deployment health
probe reaches `/api/health`; no worker or database health endpoint is public.

## Shutdown and draining

Railway sends `SIGTERM` before the configured 30-second drain window expires. The
BullMQ workers call `Worker.close()`, which stops accepting new jobs and waits for
active jobs before closing Redis. The reconciler and provider-health scheduler stop
new intervals and await the currently running cycle before exiting. This keeps a
deployment replacement from deliberately abandoning an in-flight job or scan.

Keep these values aligned:

- Railway Config as Code: `drainingSeconds: 30`
- Service variable: `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30`

If a job can legitimately exceed the drain window, increase both values before
deploying. Queue recovery settings still allow an interrupted process to be retried
after an unavoidable platform kill.

## Release and manual verification

1. Deploy or apply the database migrations from a controlled release shell:
   `bun run db:migrate`.
2. Deploy `outpay-web` and confirm the deployment uses `/railway.json`.
3. Request `https://<web-domain>/api/health`; expect HTTP 200 and
   `{ "status": "ok" }` while Postgres is reachable.
4. Deploy `outpay-payment-worker`; confirm logs contain `Payment listener worker
   started` and the service has no public domain.
5. Deploy `outpay-reconciler`; confirm logs contain `Reconciliation worker started`
   and a reconciliation cycle can reach both configured providers.
6. Deploy `outpay-webhook-worker`; confirm logs contain `Webhook dispatcher worker
   started` and the service has no public domain.
7. Send `SIGTERM` through a controlled Railway redeploy of each worker and verify
   the logs show the shutdown message only after the active job/cycle completes.
8. Verify the Postgres and Redis services have no public access path and that each
   application service resolves its private `DATABASE_URL` and `REDIS_URL`.

There are no schema, API-route, or UI changes in this deployment task.
