import type { InputHTMLAttributes } from "react";

/**
 * Input — labeled text field with hint/error state. Subtle translucent
 * fill, control border, 2px offset focus ring. size="small" (34px) is
 * the Outpay default, matching Supabase's own default.
 */
export type InputSize = "tiny" | "small" | "medium" | "large";
const HEIGHT_CLASSES: Record<InputSize, string> = {
  tiny: "h-[26px]",
  small: "h-[34px]",
  medium: "h-[38px]",
  large: "h-[42px]",
};

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({
  size = "small",
  label,
  hint,
  error,
  className = "",
  id,
  ...rest
}: InputProps) {
  const field = (
    <input
      id={id}
      className={[
        HEIGHT_CLASSES[size],
        "w-full rounded-sm border font-sans text-sm px-3 outline-none box-border transition-shadow duration-150",
        error
          ? "border-destructive bg-destructive/[0.08]"
          : "border-border-control bg-foreground/[0.026] focus:shadow-focus-ring",
        className,
      ].join(" ")}
      {...rest}
    />
  );
  if (!label && !hint && !error) return field;
  return (
    <label className="flex flex-col gap-1.5 font-sans" htmlFor={id}>
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      {field}
      {(hint || error) && (
        <span
          className={[
            "text-xs",
            error ? "text-destructive" : "text-foreground-lighter",
          ].join(" ")}
        >
          {error || hint}
        </span>
      )}
    </label>
  );
}
