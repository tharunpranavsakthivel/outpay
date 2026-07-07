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

import { connectToDatabase } from "../../src/lib/database/client";

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
  };

  for (const argument of argv) {
    switch (argument) {
      case "--execute":
        options.execute = true;
        break;
      case "--include-migrations":
        options.includeMigrations = true;
        break;
      default:
        throw new ClearCommandError(
          `Unsupported flag "${argument}". Use --execute and optionally --include-migrations.`,
        );
    }
  }

  return options;
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
  const tables = await loadTableRowCounts(options.includeMigrations);

  printInventory(tables, options.includeMigrations);

  if (!options.execute) {
    console.log(
      "No changes applied. Re-run with --execute to clear the listed tables.",
    );
    return;
  }

  await clearTables(tables);
  console.log("Database tables cleared.");
}

await main();
