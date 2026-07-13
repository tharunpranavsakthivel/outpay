/**
 * Static integrity checks for db/migrations: every migration must have a
 * paired up/down file, and 0004_payment_pipeline_support specifically must
 * create/drop the payment-detection pipeline objects in matching, reversed
 * order so `db:migrate down` can safely undo `db:migrate up`.
 */

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations",
);
const TARGET_MIGRATION = "0004_payment_pipeline_support";
const CLEANUP_MIGRATION = "0010_remove_unscheduled_billing_and_contact_schema";
const CATALOG_SEED_MIGRATION = "0014_seed_base_usdc";

async function readMigrationFile(
  suffix: "up.sql" | "down.sql",
): Promise<string> {
  return readFile(
    path.join(MIGRATIONS_DIRECTORY, `${TARGET_MIGRATION}.${suffix}`),
    "utf8",
  );
}

describe("db/migrations integrity", () => {
  it("pairs every *.up.sql with a *.down.sql", async () => {
    const entries = await readdir(MIGRATIONS_DIRECTORY, {
      withFileTypes: true,
    });
    const upFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".up.sql"))
      .map((entry) => entry.name);

    expect(upFiles.length).toBeGreaterThan(0);

    for (const upFile of upFiles) {
      const baseName = upFile.slice(0, -".up.sql".length);
      const downFile = `${baseName}.down.sql`;

      expect(entries.some((entry) => entry.name === downFile)).toBe(true);
    }
  });

  it("produces a stable checksum for the on-disk up.sql", async () => {
    const upContents = await readMigrationFile("up.sql");
    const checksum = createHash("sha256").update(upContents).digest("hex");

    expect(checksum).toHaveLength(64);
    expect(checksum).toBe(
      createHash("sha256").update(upContents).digest("hex"),
    );
  });

  it("creates the payment-pipeline objects required by ARCHITECTURE.md", async () => {
    const upContents = await readMigrationFile("up.sql");

    expect(upContents).toMatch(/create table provider_events_raw/);
    expect(upContents).toMatch(/unique \(provider, provider_event_id\)/);
    expect(upContents).toMatch(/create table chain_cursors/);
    expect(upContents).toMatch(/unique \(chain, provider, cursor_type\)/);
    expect(upContents).toMatch(
      /alter table checkout_sessions\s+add column idempotency_key/,
    );
    expect(upContents).toMatch(/unique \(merchant_id, idempotency_key\)/);
    expect(upContents).toMatch(
      /alter table wallet_addresses\s+add column updated_at/,
    );
    expect(upContents).toMatch(/trg_wallet_addresses_updated_at/);
    expect(upContents).toMatch(
      /create index idx_payments_onchain_transaction_id on payments\(onchain_transaction_id\)/,
    );
    expect(upContents).toMatch(
      /create index idx_payments_payment_intent_id on payments\(payment_intent_id\)/,
    );
    expect(upContents).toMatch(
      /create index idx_webhook_events_checkout_session_id on webhook_events\(checkout_session_id\)/,
    );
    expect(upContents).toMatch(
      /create index idx_webhook_events_payment_id on webhook_events\(payment_id\)/,
    );
  });

  it("reverts every object the up migration creates", async () => {
    const upContents = await readMigrationFile("up.sql");
    const downContents = await readMigrationFile("down.sql");

    const createdTables = [...upContents.matchAll(/create table (\w+)/g)].map(
      (match) => match[1],
    );
    const createdIndexes = [...upContents.matchAll(/create index (\w+)/g)].map(
      (match) => match[1],
    );
    const addedColumns = [...upContents.matchAll(/add column (\w+)/g)].map(
      (match) => match[1],
    );
    const createdTriggers = [
      ...upContents.matchAll(/create trigger (\w+)/g),
    ].map((match) => match[1]);
    const addedConstraints = [
      ...upContents.matchAll(/add constraint (\w+)/g),
    ].map((match) => match[1]);

    for (const table of createdTables) {
      expect(downContents).toMatch(
        new RegExp(`drop table if exists (public\\.)?${table}\\b`),
      );
    }
    for (const index of createdIndexes) {
      expect(downContents).toMatch(
        new RegExp(`drop index if exists (public\\.)?${index}\\b`),
      );
    }
    for (const column of addedColumns) {
      expect(downContents).toMatch(
        new RegExp(`drop column if exists ${column}\\b`),
      );
    }
    for (const trigger of createdTriggers) {
      expect(downContents).toMatch(
        new RegExp(`drop trigger if exists ${trigger}\\b`),
      );
    }
    for (const constraint of addedConstraints) {
      expect(downContents).toMatch(
        new RegExp(`drop constraint if exists ${constraint}\\b`),
      );
    }
  });

  it("drops dependent columns/constraints before the tables they may reference", async () => {
    const downContents = await readMigrationFile("down.sql");

    const tableDropIndex = downContents.indexOf(
      "drop table if exists public.chain_cursors",
    );
    const columnDropIndex = downContents.indexOf(
      "drop column if exists idempotency_key",
    );

    expect(tableDropIndex).toBeGreaterThan(-1);
    expect(columnDropIndex).toBeGreaterThan(-1);
    expect(columnDropIndex).toBeLessThan(tableDropIndex);
  });

  it("removes only unscheduled billing/contact objects and restores their structure on rollback", async () => {
    const [upContents, downContents] = await Promise.all([
      readFile(
        path.join(MIGRATIONS_DIRECTORY, `${CLEANUP_MIGRATION}.up.sql`),
        "utf8",
      ),
      readFile(
        path.join(MIGRATIONS_DIRECTORY, `${CLEANUP_MIGRATION}.down.sql`),
        "utf8",
      ),
    ]);
    const removedTables = [
      "pricing_plans",
      "merchant_plan_assignments",
      "merchant_usage_monthly",
      "fee_ledger_entries",
      "enterprise_contact_requests",
    ];
    const removedEnums = [
      "plan_status_enum",
      "enterprise_request_type_enum",
      "enterprise_request_status_enum",
      "fee_entry_type_enum",
    ];

    for (const table of removedTables) {
      expect(upContents).toMatch(
        new RegExp(`drop table if exists public\\.${table}\\b`),
      );
      expect(downContents).toMatch(new RegExp(`create table ${table}\\b`));
    }

    for (const enumName of removedEnums) {
      expect(upContents).toMatch(
        new RegExp(`drop type if exists public\\.${enumName}\\b`),
      );
      expect(downContents).toMatch(new RegExp(`create type ${enumName}\\b`));
    }

    expect(upContents).toMatch(
      /alter table public\.merchants\s+drop column if exists default_pricing_plan_id/,
    );
    expect(downContents).toMatch(
      /add column default_pricing_plan_id uuid references public\.pricing_plans\(id\)/,
    );
    expect(upContents).not.toMatch(
      /drop table if exists public\.merchant_reviews/,
    );
    expect(upContents).not.toMatch(/drop table if exists public\.error_logs/);
    expect(upContents).not.toMatch(/drop table if exists public\.event_logs/);
  });

  it("seeds the Base blockchain and USDC token idempotently", async () => {
    const upContents = await readFile(
      path.join(MIGRATIONS_DIRECTORY, `${CATALOG_SEED_MIGRATION}.up.sql`),
      "utf8",
    );
    const downContents = await readFile(
      path.join(MIGRATIONS_DIRECTORY, `${CATALOG_SEED_MIGRATION}.down.sql`),
      "utf8",
    );

    expect(upContents).toMatch(/insert into public\.blockchains/);
    expect(upContents).toMatch(/'base',\s+'Base',\s+8453/);
    expect(upContents).toMatch(
      /'https:\/\/basescan\.org\/tx\/\{tx_hash\}',\s+'Base mainnet'/,
    );
    expect(upContents).toMatch(/'USDC',\s+'USD Coin'/);
    expect(upContents).toMatch(/'0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913'/);
    expect(upContents).toMatch(/'0x833589fdc6edb6e08f4c7c32d4f71b54bda02913'/);
    expect(upContents.match(/on conflict do nothing/g)).toHaveLength(2);
    expect(downContents).toMatch(/delete from public\.tokens/);
    expect(downContents).toMatch(/delete from public\.blockchains/);
  });
});
