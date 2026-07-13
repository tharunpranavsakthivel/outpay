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

## Database backup and restore

T-48 is an operational prerequisite before real merchant volume. Railway backup
configuration is owned by the Railway project and is not represented by the
repository's config-as-code files. Until the verification record below is filled
from the production Railway dashboard and a scratch restore is completed, treat
backup coverage as unverified and do not represent the production database as
recoverable.

### Recovery targets

The launch operating target is:

- **RPO:** no more than 24 hours of committed merchant, checkout, payment, and
  webhook data may be lost.
- **RTO:** restore access to a validated database within 2 hours of an approved
  recovery decision.
- **Retention:** retain enough successful restore points to cover the approved
  retention period for financial and audit data. The operator must record the
  actual Railway retention below; a schedule that only covers a shorter period
  is not accepted without an explicit product-owner decision.

If product or legal requirements are stricter, the stricter target wins. Prefer
Railway Point-in-Time Recovery (PITR) for production because it restores to a
new sibling Postgres service without changing the source service. Railway's
standard volume backup schedules and PITR behavior are documented in the
[Railway backups guide](https://docs.railway.com/volumes/backups) and the
[Railway PITR guide](https://docs.railway.com/volumes/point-in-time-recovery).

### Verification record

Complete this record from the production Railway project. Do not commit
connection strings, passwords, bucket credentials, project tokens, or customer
data.

| Field | Recorded value |
| --- | --- |
| Verification date (UTC) | Pending authorized Railway operator |
| Railway project and environment | Pending authorized Railway operator |
| Postgres service | `Postgres` (confirm exact service name) |
| Backup mode | Pending: scheduled volume backups or PITR |
| Schedule / PITR archive window | Pending dashboard verification |
| Latest successful backup or available restore point | Pending dashboard verification |
| Approved RPO / RTO | `24 hours / 2 hours` unless a stricter decision is recorded |
| Scratch restore service | Pending test restore |
| Restore started / completed (UTC) | Pending test restore |
| Measured restore duration | Pending test restore |
| Integrity checks and result | Pending test restore |
| Authorized operator | Pending project member record |
| Incident/on-call contact | Project's authorized production operator; record the named owner here |

The acceptance decision is **open** until the pending fields are replaced with
dashboard and test evidence. A repository-only review cannot confirm an external
Railway setting.

### Scheduled verification

An authorized Railway project Admin/Owner must perform the following before
launch and at least quarterly thereafter:

1. Open the production project and the exact `Postgres` service.
2. Open the service's **Backups** tab and record whether a successful automated
   schedule or PITR is enabled, the schedule/archive window, the oldest available
   restore point, and the latest successful backup timestamp.
3. Compare the displayed retention with the approved RPO/RTO and retention
   policy above. Escalate rather than silently accepting a shorter window.
4. Confirm the application services still use the private
   `${{Postgres.DATABASE_URL}}` reference and that the database has no public
   access path.
5. Record the operator, UTC timestamp, dashboard values, and evidence location
   in the verification table. Store screenshots or export evidence in the
   authorized incident/change record, not in this repository.

### Scratch restore test

Use a restore operation that creates a new sibling/scratch Postgres service. Do
not select an in-place volume restore on the production `Postgres` service for a
test. Keep the source service and its connection variables unchanged.

1. Open **Postgres → Backups** in the production Railway project. Select a
   restore point that is safe to test and record its UTC timestamp.
2. For PITR, choose **Restore to this moment** and provide a clearly isolated
   name such as `Postgres-restore-YYYYMMDD-HHmm`. Railway provisions the restored
   service alongside the source. For a standard volume backup, stop and obtain
   an authorized Railway-supported workflow that produces a scratch target;
   do not deploy a staged volume replacement against production merely to test
   restore.
3. Record the UTC time immediately before starting the restore, wait for the
   scratch service to finish provisioning, and record the UTC time when its
   private connection is usable. The difference is the measured restore time.
4. From a controlled operator shell, set the scratch connection as the only
   active `DATABASE_URL` for the validation commands. Never print it or place it
   in a committed file:

   ```bash
   DATABASE_URL='<scratch-private-connection>' bun run db:status
   DATABASE_URL='<scratch-private-connection>' bun run db:validate
   ```

   `db:status` must show the expected migration state. `db:validate` must report
   that the required extensions, enums, tables, indexes, functions, triggers,
   and `auth.users` table exist. Treat any missing object or connection to the
   wrong host/database as a failed restore test.
5. Run a read-only data-integrity check against the scratch database. At minimum
   verify the restored database name, migration records, and row counts for the
   core operational tables. Counts must be compared with the selected restore
   point, not with a later live production state:

   ```bash
   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
   select current_database(), current_user;
   select name, checksum, applied_at
   from public.schema_migrations
   order by applied_at, name;
   select 'auth.users' as relation, count(*)::bigint as row_count from auth.users
   union all select 'public.merchants', count(*)::bigint from public.merchants
   union all select 'public.merchant_members', count(*)::bigint from public.merchant_members
   union all select 'public.checkout_sessions', count(*)::bigint from public.checkout_sessions
   union all select 'public.payment_intents', count(*)::bigint from public.payment_intents
   union all select 'public.payments', count(*)::bigint from public.payments
   union all select 'public.webhook_events', count(*)::bigint from public.webhook_events
   union all select 'public.audit_logs', count(*)::bigint from public.audit_logs
   order by relation;
   SQL
   ```

   The operator must also confirm that no restored secret values or customer
   records were copied into an unauthorized environment. Use masked metadata or
   aggregate counts in the incident record; do not paste customer rows into
   chat, tickets, or this repository.
6. If application verification is required, point an isolated scratch web
   deployment at the scratch database and request its `/api/health` endpoint.
   Do not repoint production services during the test.
7. Record pass/fail results, restore duration, validation output summary, and
   the scratch service name in the verification table. Remove the scratch
   service only after the authorized operator confirms that the evidence is
   retained and no further investigation needs it.

### Production recovery runbook

1. The on-call operator opens an incident and contacts the named authorized
   production operator recorded above. Only a Railway project Admin/Owner or
   another explicitly delegated operator may restore or cut over a database.
2. Freeze the cause of corruption where possible: stop deployments and schema
   changes, pause workers if they could write bad data, and preserve the
   incident's UTC timeline. Do not run `bun run db:clear` against any recovery
   target.
3. Identify the last known-good timestamp or backup and the required recovery
   scope. For accidental writes or a bad migration, prefer PITR to a timestamp
   immediately before the incident. The source database remains the evidence
   source until the restored database passes validation.
4. Restore to a new sibling Postgres service through the Railway **Backups** tab.
   Do not delete or overwrite the source while investigating.
5. Run the scratch validation in this document: `db:status`, `db:validate`,
   read-only catalog/row-count checks, and an isolated `/api/health` check if
   needed. Compare the result with the incident's expected restore point.
6. Obtain explicit approval from the incident owner before cutover. Update the
   application services' private `DATABASE_URL` reference in Railway, deploy
   the controlled change, and verify `/api/health`, worker startup, queue
   connectivity, recent checkout/payment reads, and webhook delivery state.
7. Keep the original Postgres service isolated until the incident owner confirms
   rollback is no longer required. Record the cutover time, approver, validation
   results, and any data replay or loss. If Railway cannot provision or restore
   the sibling service, contact Railway support through the project's authorized
   support channel and preserve the source service.

The rollback plan for a sibling restore is to leave the source service intact and
point the application services back to the previous private `DATABASE_URL`
reference after an approved redeploy. The rollback does not undo writes made to
the restored database, so any replay or reconciliation must be planned and
recorded separately.

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
