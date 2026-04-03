import {
  TOURNAMENT_RESULTS_ROW_PLACEMENTS,
  canonicalTournamentPlacement,
  type TournamentSettingsState,
} from "@/components/stream/tournamentSettingsDefaults";

function assignNamesToResultRows(
  players: TournamentSettingsState["players"]
): (string | null)[] {
  const assigned: (string | null)[] = Array.from(
    { length: TOURNAMENT_RESULTS_ROW_PLACEMENTS.length },
    () => null
  );
  for (const p of players) {
    const name = p.name.trim();
    const pl = canonicalTournamentPlacement(p.placement);
    if (!name || !pl) continue;
    for (let i = 0; i < TOURNAMENT_RESULTS_ROW_PLACEMENTS.length; i++) {
      if (TOURNAMENT_RESULTS_ROW_PLACEMENTS[i] === pl && assigned[i] == null) {
        assigned[i] = name;
        break;
      }
    }
  }
  return assigned;
}

export type TournamentResultsTableVariant = "dashboard" | "overlay";

type TournamentResultsTableProps = {
  settings: TournamentSettingsState;
  variant?: TournamentResultsTableVariant;
};

/**
 * Shared 16-row placement / name grid for dashboard preview and OBS browser overlay.
 */
export function TournamentResultsTable({
  settings,
  variant = "dashboard",
}: TournamentResultsTableProps) {
  const assignedNames = assignNamesToResultRows(settings.players);
  const overlay = variant === "overlay";

  return (
    <div
      className={
        overlay
          ? "space-y-4 text-base text-slate-100"
          : "space-y-3 text-sm text-slate-200"
      }
    >
      <p
        className={`text-center font-semibold text-blue-300 ${overlay ? "text-3xl" : "text-2xl"}`}
      >
        Results
      </p>
      <table
        className="w-full table-fixed border-collapse"
        aria-label="Tournament results"
      >
        <tbody>
          {TOURNAMENT_RESULTS_ROW_PLACEMENTS.map((placementLabel, i) => (
            <tr
              key={`result-row-${i}`}
              className="border-b border-white/10 last:border-b-0"
            >
              <td
                className={`w-[42%] py-2 pr-3 align-middle text-slate-400 lg:w-[40%] ${overlay ? "text-xl" : "text-lg"}`}
              >
                {placementLabel}
              </td>
              <td
                className={`py-2 align-middle font-medium leading-snug text-slate-100 ${overlay ? "text-xl" : "text-[1.094rem]"}`}
              >
                {assignedNames[i] ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
