/**
 * Applies, reverts, and reports SQL migrations for the Outpay PostgreSQL
 * schema using the repo's Bun + TypeScript toolchain.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { connectToDatabase } from "../../src/lib/database/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIRECTORY = path.resolve(__dirname, "../../db/migrations");

interface MigrationPair {
  checksum: string;
  downPath: string;
  name: string;
  upPath: string;
}

interface AppliedMigrationRecord {
  applied_at: string;
  checksum: string;
  name: string;
}

class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/**
 * Parses the CLI arguments and executes the requested migration action.
 *
 * Throws:
 * - `MigrationError` for invalid commands, missing files, or checksum drift.
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? "up";
  const stepCount = parseOptionalStepCount(process.argv[3]);
  const { release, source, sql } = await connectToDatabase();

  try {
    switch (command) {
      case "up":
        await applyPendingMigrations(sql);
        break;
      case "down":
        await revertAppliedMigrations(sql, stepCount);
        break;
      case "status":
        await printMigrationStatus(sql);
        break;
      default:
        throw new MigrationError(
          `Unsupported migration command "${command}". Use one of: up, down, status.`,
        );
    }

    console.log(`Migration command "${command}" completed using ${source}.`);
  } finally {
    await release();
  }
}

async function ensureSchemaMigrationsTable(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
): Promise<void> {
  await sql`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `;
}

async function applyPendingMigrations(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
): Promise<void> {
  await ensureSchemaMigrationsTable(sql);
  const migrations = await loadMigrationPairs();
  const appliedRecords = await getAppliedMigrationRecords(sql);
  const appliedByName = new Map(
    appliedRecords.map((record) => [record.name, record]),
  );

  for (const migration of migrations) {
    const applied = appliedByName.get(migration.name);

    if (applied) {
      if (applied.checksum !== migration.checksum) {
        throw new MigrationError(
          `Applied migration "${migration.name}" no longer matches the on-disk checksum.`,
        );
      }

      continue;
    }

    console.log(`Applying ${migration.name}...`);

    await sql.begin(async (transaction) => {
      await transaction.file(migration.upPath);
      await transaction`
        insert into public.schema_migrations (name, checksum)
        values (${migration.name}, ${migration.checksum})
      `;
    });
  }
}

async function revertAppliedMigrations(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  stepCount: number,
): Promise<void> {
  await ensureSchemaMigrationsTable(sql);
  const migrations = await loadMigrationPairs();
  const appliedRecords = await getAppliedMigrationRecords(sql);
  const migrationByName = new Map(
    migrations.map((migration) => [migration.name, migration]),
  );
  const appliedInRepoOrder = migrations
    .filter((migration) =>
      appliedRecords.some((record) => record.name === migration.name),
    )
    .reverse();

  if (appliedInRepoOrder.length === 0) {
    console.log("No applied migrations to roll back.");
    return;
  }

  const targetMigrations = appliedInRepoOrder.slice(0, stepCount);

  for (const migration of targetMigrations) {
    const record = appliedRecords.find((item) => item.name === migration.name);
    const knownMigration = migrationByName.get(migration.name);

    if (!record || !knownMigration) {
      throw new MigrationError(
        `Migration metadata for "${migration.name}" is incomplete and cannot be rolled back safely.`,
      );
    }

    if (record.checksum !== knownMigration.checksum) {
      throw new MigrationError(
        `Refusing to roll back "${migration.name}" because the applied checksum does not match the current migration file.`,
      );
    }

    console.log(`Reverting ${migration.name}...`);

    await sql.begin(async (transaction) => {
      await transaction.file(knownMigration.downPath);
      await transaction`
        delete from public.schema_migrations
        where name = ${knownMigration.name}
      `;
    });
  }
}

async function printMigrationStatus(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
): Promise<void> {
  const migrations = await loadMigrationPairs();
  const appliedRecords = await getAppliedMigrationRecords(sql);
  const appliedByName = new Map(
    appliedRecords.map((record) => [record.name, record]),
  );

  for (const migration of migrations) {
    const applied = appliedByName.get(migration.name);

    if (applied) {
      console.log(`${migration.name}: applied at ${applied.applied_at}`);
      continue;
    }

    console.log(`${migration.name}: pending`);
  }
}

async function getAppliedMigrationRecords(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
): Promise<AppliedMigrationRecord[]> {
  const migrationTable = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from pg_tables
      where schemaname = 'public' and tablename = 'schema_migrations'
    ) as exists
  `;

  if (!migrationTable[0]?.exists) {
    return [];
  }

  const rows = await sql<AppliedMigrationRecord[]>`
    select name, checksum, applied_at::text
    from public.schema_migrations
    order by name asc
  `;

  return rows;
}

async function loadMigrationPairs(): Promise<MigrationPair[]> {
  const entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  const upFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".up.sql"))
    .map((entry) => entry.name)
    .sort();

  if (upFiles.length === 0) {
    throw new MigrationError("No migration files were found in db/migrations.");
  }

  const migrations: MigrationPair[] = [];

  for (const upFile of upFiles) {
    const baseName = upFile.slice(0, -".up.sql".length);
    const downFile = `${baseName}.down.sql`;
    const downPath = path.join(MIGRATIONS_DIRECTORY, downFile);
    const upPath = path.join(MIGRATIONS_DIRECTORY, upFile);

    if (!entries.some((entry) => entry.isFile() && entry.name === downFile)) {
      throw new MigrationError(
        `Migration "${baseName}" is missing its rollback file "${downFile}".`,
      );
    }

    const upContents = await readFile(upPath, "utf8");

    migrations.push({
      checksum: createHash("sha256").update(upContents).digest("hex"),
      downPath,
      name: baseName,
      upPath,
    });
  }

  return migrations;
}

function parseOptionalStepCount(value: string | undefined): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MigrationError(
      `Invalid migration step count "${value}". Provide a positive integer.`,
    );
  }

  return parsed;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
