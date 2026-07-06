import type { HTMLAttributes } from "react";

/**
 * Card family — bordered panel, hairline shadow (not a floating drop
 * shadow), mono-uppercase title. Mirrors Supabase's shadcn/ui Card.
 */
export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xs font-sans",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "flex flex-col gap-1.5 px-4 py-4 border-b border-border",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        "text-xs font-mono uppercase tracking-[0.04em] font-medium text-foreground m-0",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={["text-sm text-foreground-lighter m-0", className].join(" ")}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["px-4 py-4 border-b border-border", className].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["flex items-center px-4 py-4", className].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
