/**
 * Small accessible table primitive shared by admin operational views.
 */

import type { ReactNode } from "react";

function getNodeKey(node: ReactNode, fallback: string): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (node && typeof node === "object" && "key" in node && node.key != null) {
    return String(node.key);
  }

  return fallback;
}

export function AdminTable({
  emptyMessage = "No records found.",
  headers,
  rows,
}: {
  emptyMessage?: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-background-surface-100 text-xs uppercase tracking-[0.08em] text-foreground-lighter">
          <tr>
            {headers.map((header) => (
              <th
                className="border-b border-border px-4 py-3 font-medium"
                key={header}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-4 py-8 text-center text-foreground-lighter"
                colSpan={headers.length}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                className="border-b border-border last:border-0"
                key={row.map((cell) => getNodeKey(cell, "cell")).join("-")}
              >
                {row.map((cell) => (
                  <td
                    className="px-4 py-3 align-top"
                    key={getNodeKey(cell, "cell")}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
