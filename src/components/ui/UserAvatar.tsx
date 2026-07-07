/**
 * Circular initials avatar for the signed-in user, shared by the dashboard
 * sidebar and marketing navbar. Users never upload a picture for themselves
 * — only a background color, picked from `AVATAR_COLOR_PALETTE` and
 * persisted to `user_profiles.avatar_color`.
 */
export const AVATAR_COLOR_PALETTE = [
  "#F87171",
  "#FB923C",
  "#FBBF24",
  "#4ADE80",
  "#2DD4BF",
  "#60A5FA",
  "#818CF8",
  "#C084FC",
  "#F472B6",
  "#94A3B8",
] as const;

export const DEFAULT_AVATAR_COLOR = AVATAR_COLOR_PALETTE[5];

export function UserAvatar({
  color,
  label,
  size = 32,
}: {
  color?: string | null;
  label: string;
  size?: number;
}) {
  const initial = label.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white"
      style={{
        height: size,
        width: size,
        backgroundColor: color || DEFAULT_AVATAR_COLOR,
      }}
    >
      <span aria-hidden="true">{initial}</span>
    </div>
  );
}
