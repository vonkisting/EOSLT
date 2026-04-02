import type { ScoreboardState } from "@/components/stream/streamObsFormDefaults";

type ScoreboardOverlayViewProps = {
  value: ScoreboardState;
  variant: "dashboard" | "overlay";
};

/**
 * Shared scoreboard layout: dashboard preview vs OBS browser overlay (larger type).
 */
export function ScoreboardOverlayView({ value, variant }: ScoreboardOverlayViewProps) {
  const overlay = variant === "overlay";
  const nameCls = overlay
    ? "truncate text-xl font-semibold sm:text-2xl"
    : "truncate font-semibold text-slate-200";
  const scoreCls = overlay
    ? "text-5xl font-bold tabular-nums sm:text-6xl"
    : "text-2xl font-bold tabular-nums text-blue-300";
  const vsCls = overlay
    ? "text-sm font-semibold uppercase tracking-widest text-yellow-300 sm:text-base"
    : "text-xs font-medium uppercase tracking-widest text-yellow-400";

  return (
    <div
      className={
        overlay
          ? "flex w-full max-w-4xl items-center justify-between gap-6 px-4 py-2 text-white sm:gap-10 sm:px-8"
          : "mt-2 flex items-center justify-between gap-4 text-sm"
      }
    >
      <div className="min-w-0 flex-1 text-center">
        <div className={nameCls}>{value.awayName || "Away"}</div>
        <div className={`${scoreCls} ${overlay ? "text-blue-300" : ""}`}>{value.awayScore}</div>
      </div>
      <span className={`shrink-0 ${vsCls}`}>vs</span>
      <div className="min-w-0 flex-1 text-center">
        <div className={nameCls}>{value.homeName || "Home"}</div>
        <div className={`${scoreCls} ${overlay ? "text-blue-300" : ""}`}>{value.homeScore}</div>
      </div>
    </div>
  );
}
