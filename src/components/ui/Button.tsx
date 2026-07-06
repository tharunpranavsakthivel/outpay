import type React from "react";
import type { ButtonHTMLAttributes } from "react";

/**
 * Button — primary interactive element. Variants/sizes mirror the Outpay
 * Design System's Button (extracted from Supabase's packages/ui Button.tsx).
 */
export type ButtonVariant =
  | "primary"
  | "default"
  | "secondary"
  | "outline"
  | "dashed"
  | "text"
  | "danger"
  | "warning";
export type ButtonSize = "tiny" | "small" | "medium" | "large";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  tiny: "h-[26px] px-[10px] text-xs gap-1.5",
  small: "h-[34px] px-3 text-sm gap-2",
  medium: "h-[38px] px-4 text-sm gap-2",
  large: "h-[42px] px-4 text-base gap-2",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-foreground border border-primary/75 hover:brightness-95",
  default:
    "bg-background border border-border-strong text-foreground hover:bg-accent",
  secondary:
    "bg-foreground text-background border border-foreground-light hover:opacity-90",
  outline:
    "bg-transparent border border-border-strong text-foreground hover:bg-accent",
  dashed:
    "bg-transparent border border-dashed border-border-strong text-foreground hover:bg-accent",
  text: "bg-transparent border border-transparent text-foreground hover:bg-accent",
  danger:
    "bg-destructive/20 border border-border-destructive text-foreground hover:bg-destructive/30",
  warning:
    "bg-warning/20 border border-border-warning text-foreground hover:bg-warning/30",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  rounded?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "small",
  block = false,
  rounded = false,
  type = "button",
  icon,
  iconRight,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        block ? "flex w-full" : "inline-flex",
        "items-center justify-center font-sans font-body whitespace-nowrap transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        rounded ? "rounded-full" : "rounded-sm",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
