/**
 * Switch — pill toggle. Brand-green track when checked, thumb slides.
 */
export type SwitchSize = "small" | "medium" | "large";
const SIZE_CLASSES: Record<
  SwitchSize,
  { track: string; thumb: string; thumbOn: string; thumbOff: string }
> = {
  small: {
    track: "w-7 h-4",
    thumb: "w-3 h-3",
    thumbOn: "left-[13px]",
    thumbOff: "left-[1px]",
  },
  medium: {
    track: "w-[34px] h-5",
    thumb: "w-4 h-4",
    thumbOn: "left-[15px]",
    thumbOff: "left-[1px]",
  },
  large: {
    track: "w-11 h-6",
    thumb: "w-[18px] h-[18px]",
    thumbOn: "left-[23px]",
    thumbOff: "left-[1px]",
  },
};

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  size?: SwitchSize;
  disabled?: boolean;
}

export function Switch({
  checked,
  onChange,
  size = "medium",
  disabled = false,
}: SwitchProps) {
  const s = SIZE_CLASSES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        s.track,
        "relative rounded-full border border-transparent p-0 transition-colors duration-150",
        checked ? "bg-primary" : "bg-accent",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          s.thumb,
          "absolute top-1/2 -translate-y-1/2 rounded-full shadow-sm transition-[left] duration-150",
          checked
            ? `${s.thumbOn} bg-white`
            : `${s.thumbOff} bg-foreground-lighter`,
        ].join(" ")}
      />
    </button>
  );
}
