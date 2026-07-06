import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Table family — mono-uppercase heading-meta column labels, row hover
 * highlight, hairline row borders. Mirrors Supabase's shadcn/ui Table.
 */
export function Table({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={["w-full border-collapse text-sm font-sans", className].join(
        " ",
      )}
      {...rest}
    >
      {children}
    </table>
  );
}
export function TableHeader({
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...rest}>{children}</thead>;
}
export function TableBody({
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest}>{children}</tbody>;
}
export function TableRow({
  className = "",
  hoverable = true,
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }) {
  return (
    <tr
      className={[
        "border-b border-border transition-colors duration-100",
        hoverable ? "hover:bg-background-surface-200" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </tr>
  );
}
export function TableHead({
  className = "",
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={[
        "h-10 px-4 text-left align-middle whitespace-nowrap text-[11px] font-mono uppercase tracking-[0.06em] font-medium text-foreground-lighter",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}
export function TableCell({
  className = "",
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={["p-4 align-middle text-foreground", className].join(" ")}
      {...rest}
    >
      {children}
    </td>
  );
}
