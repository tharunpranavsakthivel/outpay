import type { HTMLAttributes } from "react";

/**
 * StatusPill — small status/label pill (Supabase's Badge, renamed for
 * Outpay's payment/webhook status domain). Fully-round, uppercase, 9px text.
 */
export type StatusPillVariant =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "secondary";

const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  default:
    "bg-background-surface-75 text-foreground-light border border-border-strong",
  success: "bg-primary/10 text-primary border border-border-brand",
  warning: "bg-warning/10 text-warning border border-border-warning",
  destructive:
    "bg-destructive/10 text-destructive border border-border-destructive",
  secondary: "bg-secondary text-secondary-foreground border border-transparent",
};

export interface StatusPillProps extends HTMLAttributes<HTMLDivElement> {
  variant?: StatusPillVariant;
}

export function StatusPill({
  variant = "default",
  className = "",
  children,
  ...rest
}: StatusPillProps) {
  return (
    <div
      className={[
        "inline-flex items-center gap-1 justify-center rounded-full font-medium whitespace-nowrap uppercase font-sans",
        "text-[9px] leading-none tracking-[0.07em] px-[7px] py-1",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
