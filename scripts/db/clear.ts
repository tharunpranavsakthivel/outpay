/**
 * Dry-runs or clears application tables in the configured PostgreSQL database.
 *
 * This script enumerates the `public` and `auth` schemas used by Outpay,
 * prints the row counts for each target table, and only executes a destructive
 * `TRUNCATE ... RESTART IDENTITY CASCADE` when the caller passes `--execute`.
 * Migration metadata is excluded by default because wiping
 * `public.schema_migrations` would make the app think the schema was never
 * applied.
 */

import { createInterface } from "node:readline/promises";

import { connectToDatabase } from "../../src/lib/database/client";
import {
  type DatabaseConnectionCandidate,
  resolveDatabaseConnectionCandidates,
} from "../../src/lib/database/config";

const PRODUCTION_OVERRIDE_FLAG = "--i-understand-this-is-production";
const DEFAULT_PRODUCTION_DB_HOST_PATTERN =
  "(^|\\.)(railway\\.(app|internal)|rlwy\\.net)$";

const TARGET_SCHEMAS = ["auth", "public"] as const;
const MIGRATION_TABLE = {
  schema: "public",
  table: "schema_migrations",
} as const;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface TableRowCount {
  rowCount: bigint;
  tableName: string;
  tableSchema: string;
}

interface ClearCommandOptions {
  execute: boolean;
  includeMigrations: boolean;
  understandProduction: boolean;
}

interface DatabaseTarget {
  databaseName: string;
  host: string;
}

interface ExecutionSafetyContext {
  productionTargets: DatabaseTarget[];
  targets: DatabaseTarget[];
}

class ClearCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClearCommandError";
  }
}

/**
 * Parses CLI flags for the clear command.
 *
 * Parameters:
 * - argv: Raw process arguments after the Bun entrypoint.
 *
 * Returns:
 * - Parsed execution options for destructive safeguards.
 *
 * Throws:
 * - `ClearCommandError` when the caller passes an unsupported flag.
 */
function parseOptions(argv: string[]): ClearCommandOptions {
  const options: ClearCommandOptions = {
    execute: false,
    includeMigrations: false,
    understandProduction: false,
  };

  for (const argument of argv) {
    switch (argument) {
      case "--execute":
        options.execute = true;
        break;
      case "--include-migrations":
        options.includeMigrations = true;
        break;
      case PRODUCTION_OVERRIDE_FLAG:
        options.understandProduction = true;
        break;
      default:
        throw new ClearCommandError(
          `Unsupported flag "${argument}". Use --execute, optionally --include-migrations, and only use ${PRODUCTION_OVERRIDE_FLAG} for an intentional production operation.`,
        );
    }
  }

  return options;
}

/**
 * Parses a PostgreSQL connection target without exposing credentials.
 *
 * Parameters:
 * - candidate: Configured database connection candidate.
 *
 * Returns:
 * - Hostname and database name for safety checks and confirmation prompts.
 *
 * Throws:
 * - `ClearCommandError` when the connection URL cannot be inspected safely.
 */
function parseDatabaseTarget(
  candidate: DatabaseConnectionCandidate,
): DatabaseTarget {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate.url);
  } catch {
    throw new ClearCommandError(
      `Refusing to execute because ${candidate.source} is not a parseable PostgreSQL URL.`,
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new ClearCommandError(
      `Refusing to execute because ${candidate.source} does not use a PostgreSQL URL.`,
    );
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new ClearCommandError(
      `Refusing to execute because ${candidate.source} contains an invalid encoded database name.`,
    );
  }

  if (!parsedUrl.hostname || !databaseName) {
    throw new ClearCommandError(
      `Refusing to execute because ${candidate.source} does not contain both a database host and database name.`,
    );
  }

  return {
    databaseName,
    host: parsedUrl.hostname,
  };
}

/**
 * Builds the production-host matcher from the environment, using a conservative
 * Railway default so production protection remains active when configuration is omitted.
 *
 * Returns:
 * - Case-insensitive regular expression used to classify database hosts.
 *
 * Throws:
 * - `ClearCommandError` when `PRODUCTION_DB_HOST_PATTERN` is not valid regex syntax.
 */
function getProductionHostPattern(): RegExp {
  const pattern =
    process.env.PRODUCTION_DB_HOST_PATTERN?.trim() ||
    DEFAULT_PRODUCTION_DB_HOST_PATTERN;

  try {
    return new RegExp(pattern, "i");
  } catch {
    throw new ClearCommandError(
      "Refusing to execute because PRODUCTION_DB_HOST_PATTERN is not a valid regular expression.",
    );
  }
}

/**
 * Inspects every configured connection candidate before any database connection is opened.
 *
 * Returns:
 * - Safety metadata for the configured targets.
 *
 * Throws:
 * - `ClearCommandError` when candidates are invalid or point at different databases.
 */
function inspectExecutionTargets(): ExecutionSafetyContext {
  let candidates: DatabaseConnectionCandidate[];

  try {
    candidates = resolveDatabaseConnectionCandidates();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ClearCommandError(`Refusing to execute: ${message}`);
  }

  const targets = candidates.map(parseDatabaseTarget);
  const databaseNames = new Set(targets.map((target) => target.databaseName));

  if (databaseNames.size !== 1) {
    throw new ClearCommandError(
      "Refusing to execute because configured database candidates point at different database names. Configure only the intended target before retrying.",
    );
  }

  const productionHostPattern = getProductionHostPattern();
  const productionTargets = targets.filter((target) =>
    productionHostPattern.test(target.host),
  );

  return { productionTargets, targets };
}

/**
 * Enforces the explicit production opt-in before a destructive operation.
 *
 * Parameters:
 * - safety: Inspected database targets and production classifications.
 * - understandProduction: Whether the exact production override flag was supplied.
 *
 * Throws:
 * - `ClearCommandError` when a production-pattern host lacks the exact override flag.
 */
function enforceProductionGuard(
  safety: ExecutionSafetyContext,
  understandProduction: boolean,
): void {
  if (safety.productionTargets.length === 0 || understandProduction) {
    return;
  }

  const hosts = safety.productionTargets
    .map((target) => target.host)
    .join(", ");
  throw new ClearCommandError(
    `Refusing to execute against production-pattern database host(s): ${hosts}. If this is intentional, rerun with the exact ${PRODUCTION_OVERRIDE_FLAG} flag and complete the database-name confirmation.`,
  );
}

/**
 * Prints the inspected target without logging credentials or connection strings.
 *
 * Parameters:
 * - targets: Configured database targets.
 */
function printExecutionTargets(targets: DatabaseTarget[]): void {
  console.log("Destructive database target");

  for (const target of targets) {
    console.log(`Host: ${target.host}`);
    console.log(`Database: ${target.databaseName}`);
  }
}

/**
 * Requires an exact interactive database-name confirmation before truncation.
 *
 * Parameters:
 * - targets: Configured database targets, which all share one database name.
 *
 * Throws:
 * - `ClearCommandError` when no interactive terminal is available or the exact name is not entered.
 */
async function confirmDestructiveExecution(
  targets: DatabaseTarget[],
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new ClearCommandError(
      "Refusing to execute without an interactive terminal. Run the command directly and type the exact database name when prompted.",
    );
  }

  const databaseName = targets[0]?.databaseName;

  if (!databaseName) {
    throw new ClearCommandError(
      "Refusing to execute because the database name could not be confirmed.",
    );
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let enteredName: string;

  try {
    enteredName = await readline.question(
      `Type the database name (${databaseName}) to confirm truncation: `,
    );
  } catch {
    throw new ClearCommandError(
      "Unable to read the database-name confirmation. No changes were applied.",
    );
  } finally {
    readline.close();
  }

  if (enteredName.trim() !== databaseName) {
    throw new ClearCommandError(
      "Database-name confirmation did not match exactly. No changes were applied.",
    );
  }
}

/**
 * Quotes a PostgreSQL identifier after validating its shape.
 *
 * Parameters:
 * - identifier: Schema or table name sourced from code or catalog metadata.
 *
 * Returns:
 * - Double-quoted identifier safe for inclusion in SQL text.
 *
 * Throws:
 * - `ClearCommandError` when the identifier contains unsafe characters.
 */
function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new ClearCommandError(
      `Refusing to use unsafe SQL identifier "${identifier}".`,
    );
  }

  return `"${identifier}"`;
}

/**
 * Converts a schema/table pair into a fully-qualified SQL identifier.
 *
 * Parameters:
 * - tableSchema: PostgreSQL schema name.
 * - tableName: PostgreSQL table name.
 *
 * Returns:
 * - Qualified identifier such as `"public"."user"`.
 */
function toQualifiedTableName(tableSchema: string, tableName: string): string {
  return `${quoteIdentifier(tableSchema)}.${quoteIdentifier(tableName)}`;
}

/**
 * Loads the tables that are eligible for a wipe operation.
 *
 * Parameters:
 * - includeMigrations: Whether `public.schema_migrations` should be included.
 *
 * Returns:
 * - Ordered list of table metadata with live row counts.
 */
async function loadTableRowCounts(
  includeMigrations: boolean,
): Promise<TableRowCount[]> {
  const database = await connectToDatabase();

  try {
    const tableRows = await database.sql<
      {
        table_name: string;
        table_schema: string;
      }[]
    >`
      select table_schema, table_name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema in (${TARGET_SCHEMAS[0]}, ${TARGET_SCHEMAS[1]})
      order by table_schema asc, table_name asc
    `;

    const counts: TableRowCount[] = [];

    for (const row of tableRows) {
      if (
        !includeMigrations &&
        row.table_schema === MIGRATION_TABLE.schema &&
        row.table_name === MIGRATION_TABLE.table
      ) {
        continue;
      }

      const qualifiedTableName = toQualifiedTableName(
        row.table_schema,
        row.table_name,
      );
      const countRows = await database.sql<{ count: string }[]>`
        select count(*)::text as count
        from ${database.sql.unsafe(qualifiedTableName)}
      `;

      counts.push({
        rowCount: BigInt(countRows[0]?.count ?? "0"),
        tableName: row.table_name,
        tableSchema: row.table_schema,
      });
    }

    return counts;
  } finally {
    await database.release();
  }
}

/**
 * Prints the dry-run inventory so the caller can confirm the wipe scope.
 *
 * Parameters:
 * - tables: Target tables with current row counts.
 * - includeMigrations: Whether migration metadata is part of the target set.
 */
function printInventory(
  tables: TableRowCount[],
  includeMigrations: boolean,
): void {
  const totalRows = tables.reduce(
    (sum, table) => sum + table.rowCount,
    BigInt(0),
  );

  console.log("Database clear dry run");
  console.log(
    `Target schemas: ${TARGET_SCHEMAS.join(", ")}${includeMigrations ? " (including public.schema_migrations)" : ""}`,
  );

  for (const table of tables) {
    console.log(
      `${table.tableSchema}.${table.tableName}\t${table.rowCount.toString()}`,
    );
  }

  console.log(
    `Would clear ${tables.length} tables containing ${totalRows.toString()} total rows.`,
  );
}

/**
 * Executes the destructive truncate after the dry-run output has been shown.
 *
 * Parameters:
 * - tables: Target tables to clear.
 *
 * Throws:
 * - `ClearCommandError` when no tables are available to clear.
 */
async function clearTables(tables: TableRowCount[]): Promise<void> {
  if (tables.length === 0) {
    throw new ClearCommandError("No database tables matched the clear scope.");
  }

  const truncateTargetList = tables
    .map((table) => toQualifiedTableName(table.tableSchema, table.tableName))
    .join(", ");
  const database = await connectToDatabase();

  try {
    await database.sql.begin(async (sql) => {
      await sql.unsafe(
        `truncate table ${truncateTargetList} restart identity cascade`,
      );
    });
  } finally {
    await database.release();
  }
}

/**
 * Runs the dry-run inventory and optionally the destructive clear.
 *
 * Throws:
 * - `ClearCommandError` for invalid flags or invalid wipe scope.
 */
async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const executionSafety = options.execute ? inspectExecutionTargets() : null;

  if (executionSafety) {
    enforceProductionGuard(executionSafety, options.understandProduction);
    printExecutionTargets(executionSafety.targets);
  }

  const tables = await loadTableRowCounts(options.includeMigrations);

  printInventory(tables, options.includeMigrations);

  if (!options.execute) {
    console.log(
      "No changes applied. Re-run with --execute to clear the listed tables.",
    );
    return;
  }

  if (!executionSafety) {
    throw new ClearCommandError(
      "Execution safety checks were not initialized.",
    );
  }

  await confirmDestructiveExecution(executionSafety.targets);
  await clearTables(tables);
  console.log("Database tables cleared.");
}

await main();
