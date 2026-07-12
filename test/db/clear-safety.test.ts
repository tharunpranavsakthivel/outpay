/**
 * Verifies that the destructive database-clear CLI refuses production-pattern
 * targets before opening a PostgreSQL connection.
 *
 * Dependencies:
 * - Bun test runtime for spawning the CLI.
 * - `scripts/db/clear.ts` for the guarded destructive command.
 */

import { expect, test } from "bun:test";

const CLEAR_SCRIPT_PATH = new URL("../../scripts/db/clear.ts", import.meta.url)
  .pathname;

/**
 * Runs the clear command with a production-pattern URL and asserts that the
 * exact override flag is required before database access can occur.
 *
 * Returns:
 * - A promise resolved after the child process exits and its output is checked.
 */
test("refuses execute mode for production-pattern database hosts", async () => {
  const databaseUrl =
    "postgresql://user:password@production.railway.app:5432/outpay";
  const child = Bun.spawn(
    ["bun", "--env-file=/dev/null", CLEAR_SCRIPT_PATH, "--execute"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_PUBLIC_URL: "",
        PGDATABASE: "",
        PGHOST: "",
        PGPASSWORD: "",
        PGPORT: "",
        PGUSER: "",
        PRODUCTION_DB_HOST_PATTERN: "(^|\\.)railway\\.app$",
      },
      stderr: "pipe",
      stdout: "pipe",
    },
  );

  const [exitCode, standardOutput, errorOutput] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const output = `${standardOutput}\n${errorOutput}`;

  expect(exitCode).not.toBe(0);
  expect(output).toContain(
    "Refusing to execute against production-pattern database host(s)",
  );
});
