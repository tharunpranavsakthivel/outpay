---
title: 2026-07-17 — Payment detection never worked in production
description: Postmortem for the outage where no on-chain USDC payment could ever be detected, its five independent root causes, and the fixes applied.
---

# 2026-07-17 — Payment detection never worked in production

## Status

Resolved. All fixes are deployed to production. **Not yet committed to git**
as of this writing — see [Outstanding work](#outstanding-work).

## Summary

A merchant sent 1 USDC on Base to a live checkout and the checkout never
left `pending`. Investigation started from that single report and expanded
into a full audit of the payment-detection pipeline, because the first fix
(create the missing worker services) uncovered a second bug, which uncovered
a third, and so on. In total, **five independent, previously-undiscovered
bugs** were found and fixed, plus one infrastructure gap. Most significantly:
the primary detection path (Alchemy webhook → normalize → match → settle)
had a normalization bug that silently dropped **every real webhook delivery
Outpay had ever received**. There is no evidence any on-chain USDC transfer
had ever been successfully detected in production before this incident.

## Impact

- No checkout had ever been automatically marked `paid` from a real on-chain
  transfer. The only settlement path that could work was a manual/admin one.
- The backup reconciliation worker (`outpay-reconciler`) had never completed
  a single scan cycle since the product's inception — `chain_cursors` was
  empty and `onchain_transactions` had zero rows before this incident.
- Six pre-existing checkout/payment-intent rows (all test/demo data, no
  confirmed payments) were deleted as part of remediation, with the
  merchant's and users' accounts left untouched. See
  [Data cleanup](#data-cleanup).

## Timeline (UTC, 2026-07-17)

| Time | Event |
| --- | --- |
| 09:12 | Merchant sends 1 USDC on Base to checkout `chk_97b269ee8c04`. Alchemy's webhook fires correctly and is received by `outpay`. |
| 09:12:54 | `outpay`'s own logs show the webhook intake logged `eventCount=0` — the webhook was normalized into **zero** events and silently discarded. Nothing was ever enqueued for matching. |
| ~09:42 | Checkout expires, still `pending`. |
| (later) | Merchant reports the payment never reflected. Investigation begins. |
| — | Direct production-DB query finds the checkout still `pending`/`awaiting_payment`, `onchain_transactions` empty, `chain_cursors` empty, `provider_events_raw` holding the real webhook payload with `processed_at: null`. |
| — | Railway CLI audit finds the project has only 4 services (`outpay`, `outpay-docs`, `Postgres`, `Redis`). `outpay-payment-worker`, `outpay-reconciler`, and `outpay-webhook-worker` — documented in `DEPLOYMENT.md` as required — were **never created**. |
| — | Three missing worker services created, wired with production env vars, and (after a Railway Free-plan resource-limit upgrade and a manual dashboard step to set each service's custom start command — see [Railway CLI limitation](#railway-cli-limitation)) brought online. |
| — | All six pre-existing test checkouts wiped per merchant request; 2 merchants and 3 users preserved. |
| — | Reconciler now runs but every scan cycle fails: **Root cause 1**. |
| — | Fixed; reconciler now fetches real events, then crashes: **Root cause 2**. |
| — | Fixed; reconciler processes cleanly, but cross-referencing `outpay`'s own webhook-intake logs from 09:12:54 surfaces **Root cause 3** — the actual reason the original payment was never detected. |
| — | Reconciler redesigned per operator spec (chunking cadence, provider fallback order) to work within Alchemy's Free-tier constraints. |
| — | Reconciler now processes real backlog volume and crashes on a legitimate zero-value transfer: **Root cause 4**. |
| — | Fixed; reconciler now processes a real backlog burst and gets HTTP 429'd by Alchemy: **Root cause 5**. |
| — | Pacing/retry/backoff added per operator spec. Reconciler catches up cleanly; `onchain_transactions` grows from 0 to 21,000+ rows with zero errors. |
| — | Chainstack (the configured fallback provider) investigated directly against its live endpoint; confirmed to be plan-limited rather than misconfigured. Provider-capability filtering added so deep scans stop wasting retries on a provider that can never serve them. |

## Root causes

### 1. Alchemy Free-tier `eth_getLogs` 10-block limit (HTTP 400)

`workers/reconciler.ts` scanned in 180-block ("recent") and 4,000-block
("deep") windows in a single `eth_getLogs` call. Alchemy's Free tier rejects
any `eth_getLogs` request spanning more than 10 blocks:

> *"Under the Free tier plan, you can make eth_getLogs requests with up to a
> 10 block range... Upgrade to PAYG for expanded block range."*

Every single scan cycle, on every run, failed immediately. This is why
`chain_cursors` had never recorded a successful scan.

**Fix:** the reconciler now walks its target range in `SCAN_CHUNK_BLOCKS`
(default 10) chunks, one `eth_getLogs` call per chunk, persisting cursor
progress after each chunk instead of only at the end of a cycle.

### 2. `BigInt` values passed to `JSON.stringify`

Once chunking let the reconciler actually fetch real transfer events, it
crashed with `"Do not know how to serialize a BigInt"`. `reserveRawEvent`
embedded a `NormalizedChainEvent` object directly into a `JSON.stringify`
call; `amountUnits` and `blockNumber` on that type are native `bigint`,
which `JSON.stringify` cannot serialize.

**Fix:** added `serializeChainEvent()`, converting both fields to strings
before serialization.

### 3. Webhook normalization read fields from the wrong location (the original bug)

`normalizeActivity()` in `src/lib/payments/normalize-event.ts` read
`logIndex` and `blockHash` from the top level of an Alchemy Address Activity
`activity` entry. Alchemy's real payload nests these under `activity.log`:

```json
{
  "fromAddress": "0x81f8...b53",
  "toAddress": "0x58a4...da3",
  "hash": "0xee42...479a",
  "value": 1,
  "rawContract": { "address": "0x8335...2913", "decimals": 6, "rawValue": "0x...f4240" },
  "log": { "logIndex": "0x10", "blockHash": "0x33de...09c1", "blockNumber": "0x2e7ca99", "...": "..." }
}
```

Since `activity.logIndex` never existed, `normalizeActivity()` always
returned `null` for real deliveries, and `normalizeAlchemyAddressActivityPayload()`
always returned an empty array. The webhook route logged this correctly
(`eventCount=0`) but nothing downstream ever surfaced it as an error —
the raw payload was stored for audit purposes and the request returned
`200 OK`, so Alchemy never retried and no alert fired.

The unit test fixture for this function had the same wrong shape (top-level
`logIndex`/`blockHash`), which is why this shipped and stayed undetected —
the test never exercised Alchemy's actual payload structure.

**Fix:** `normalizeActivity()` now checks `activity.log.logIndex` /
`activity.log.blockHash` (falling back to the top level for forward/backward
compatibility with other payload shapes). A regression test using the exact
captured production payload was added to `test/alchemy-webhook.test.ts`.

**This is the actual root cause of the reported incident.** Everything
above and below it was found only because fixing this one required first
standing up the workers and reconciler, which then exposed the other four
issues.

### 4. Zero-value transfers violate a database check constraint

Once the reconciler was processing real chain data at volume, it hit a
legitimate on-chain `Transfer(from, to, 0)` event (valid per the ERC-20
standard, occasionally emitted as a no-op) and crashed:

```
new row for relation "onchain_transactions" violates check constraint
"onchain_transactions_amount_token_check"
```

`onchain_transactions.amount_token` has a `CHECK (amount_token > 0)`
constraint. Because this chunk was retried identically on every scheduled
cycle, it permanently stalled the deep scan's cursor on that block range.

**Fix:** both normalizers (`normalizeActivity` and `normalizeRpcTransferLog`
in `src/lib/payments/normalize-event.ts`) now reject `amountUnits <= 0` at
the normalization boundary — a zero-value transfer can never satisfy a
positive checkout amount, so there is no reason to ever attempt persisting
one.

### 5. Alchemy Free-tier throughput limit (HTTP 429) during backlog catch-up

With the 10-block chunking fix in place, a burst of chunk scans and
per-event lookups during backlog catch-up exceeded Alchemy's Free-tier
throughput cap (~500 Compute Units Per Second), producing HTTP 429s. The
existing failover to Chainstack didn't help: a single chunk's failure threw
out of the provider loop entirely instead of falling through to the next
provider (a pre-existing bug in the original failover loop, fixed as part of
the same rewrite).

**Fix**, per explicit operator specification:

- 10-block chunks, processed strictly sequentially (concurrency 1).
- A ~275ms minimum gap enforced between every RPC request the reconciler
  issues, including each internal attempt inside the provider router's own
  retry/failover.
- On failure: respect `Retry-After` when the provider sends one (added
  `httpStatus`/`retryAfterMs` fields to `AlchemyRpcError`/`ChainstackRpcError`
  purely additively); otherwise exponential backoff with jitter, capped at
  30s, up to 6 attempts.
- Persistence failures (e.g. a database write error) are *not* retried —
  only RPC/provider-layer failures are, since backing off doesn't fix a bad
  write.
- The cursor advances only after a chunk fully succeeds. A chunk that
  exhausts its retries is retried by the next scheduled cycle, never
  skipped.

## Infrastructure gap: Chainstack is not an equivalent fallback for deep scans

Diagnosed directly against the live Chainstack endpoint (not assumed):

| Call | Range | Result |
| --- | --- | --- |
| `eth_blockNumber` | — | 200 |
| `eth_getBlockByNumber` | current tip | 200 |
| `eth_getBlockByNumber` | tip − 5 | 200 |
| `eth_getBlockByNumber` | tip − 500 | **403** — `"Archive, Debug and Trace requests are not available on your current plan."` |
| `eth_getLogs` | recent 10-block range | 200 |
| `eth_getLogs` | old 10-block range (matching the reconciler's actual deep-scan position) | **403**, same message |

Chainstack is correctly configured and reachable — it's on a non-archive
plan tier, which only serves near-tip data. It is a valid fallback for the
`recent` scan (always a shallow, near-tip range) but can never serve the
`deep` scan, which by design reads hundreds to thousands of blocks behind
the tip.

**Fix:** `workers/reconciler.ts` now declares provider archive capability
explicitly (`PROVIDER_ARCHIVE_CAPABILITY: { alchemy: true, chainstack: false }`)
and filters the provider order for `deep` scans down to archive-capable
providers only — Alchemy alone. `recent` scans are unaffected and still use
Alchemy → retry on 429 → Chainstack fallback. This avoids wasting a request
and a retry budget on a call that can never succeed.

A related optimization was added at the same time: `fetchBlockTimestamp` in
`src/lib/payments/match-payment.ts` now caches results in a bounded
(5,000-entry) in-memory map, since multiple transfers routinely share a
block during backlog catch-up. This is purely additive (same results, fewer
redundant RPC calls) and safe for the real-time payment-worker path too.

True provider redundancy for deep scans would require upgrading Chainstack
to an archive-enabled plan; this was not done as part of this incident.

## Railway CLI limitation

Creating the three missing worker services via the Railway CLI (`railway
add --repo ... --service ...`) worked, but pointing each service at its own
start command does not have a CLI or Infrastructure-as-Code equivalent in
this CLI version. `railway environment edit --service-config <service>
deploy.startCommand "..."` silently no-ops for any service governed by a
repo-root `railway.json` config-as-code file (which every service in this
repo picks up by default) — confirmed empirically and against Railway's own
documentation. The only working mechanism is the dashboard's **Settings →
Deploy → Custom Start Command** field, done manually by the operator for
each of the three new services.

## Data cleanup

At the operator's explicit request (with scope confirmed via a clarifying
prompt showing exact row counts before proceeding): all 6 pre-existing
`checkout_sessions` rows and their `payment_intents` were deleted, cascading
to the (empty) `payments`, `payment_match_failures`, `webhook_events`, and
`checkout_status_history` tables. `merchants` (2 rows) and `auth.users` (3
rows) were explicitly preserved and confirmed unchanged before and after.

## Verification

- **Tests:** ~20 new tests added across `test/chainstack-reconciliation.test.ts`,
  `test/alchemy-webhook.test.ts`. Full suite went from 150 passing on `main`
  to 167 passing, with the same 9 pre-existing, unrelated failures confirmed
  present on `main` via `git stash` comparison (a test-isolation issue in
  `test/db/client-pool.test.ts` and `test/contact` routes, unrelated to this
  work).
- **Typecheck and lint:** clean on every changed file; two pre-existing
  `tsc` errors in `test/alchemy-webhook.test.ts` (bigint literal syntax
  under this project's `ES2017` target) and one pre-existing biome
  import-order warning were confirmed present on `main` and left untouched.
- **Live:** `onchain_transactions` grew from 0 rows to 21,348+ rows over the
  course of remediation, with zero errors in the reconciler's logs in its
  final state. Both the `recent` and `deep` `chain_cursors` rows show fresh
  `last_success_at` timestamps advancing continuously.

## Files changed

- `workers/reconciler.ts` — chunked scanning, single cursor per scan type,
  provider fallback (fixed), pacing/retry/backoff, archive-capability
  filtering.
- `src/lib/payments/normalize-event.ts` — `activity.log.*` field fix,
  zero-amount rejection (both normalizers).
- `src/lib/payments/match-payment.ts` — bounded block-timestamp cache.
- `src/lib/providers/alchemy.ts`, `src/lib/providers/chainstack.ts` —
  additive `httpStatus`/`retryAfterMs` fields on their error classes.
- `src/lib/providers/retry-after.ts` — new; shared `Retry-After` header
  parser.
- `test/chainstack-reconciliation.test.ts`, `test/alchemy-webhook.test.ts` —
  rewritten/expanded to cover the new behavior and the real Alchemy payload
  shape.

## Outstanding work

- **None of the above is committed to git as of this writing.** Everything
  was deployed directly from the working tree via `railway up` (the same
  mechanism used to stand up the worker services in the first place). A
  future `git`-triggered deploy would silently revert all of it. This
  should be committed (on a branch, per this repo's contribution rules) and
  opened as a PR as the immediate next step.
- Consider upgrading Chainstack to an archive-enabled plan if true deep-scan
  provider redundancy is required.
- `DEPLOYMENT.md`'s worker-service topology table is now accurate in
  practice (the services exist and are configured as documented) but was
  not re-audited line-by-line as part of this incident.
