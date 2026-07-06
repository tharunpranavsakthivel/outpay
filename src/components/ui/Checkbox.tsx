import { Check } from "lucide-react";

/** Checkbox — 16x16, rounded-sm, filled foreground when checked. */
export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
}: CheckboxProps) {
  return (
    <label
      className={[
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        "inline-flex",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "w-4 h-4 rounded p-0 inline-flex items-center justify-center border",
          checked
            ? "bg-foreground border-transparent"
            : "bg-border-control/25 border-border-control",
        ].join(" ")}
      >
        {checked && (
          <Check size={10} strokeWidth={4} className="text-background" />
        )}
      </span>
    </label>
  );
}
