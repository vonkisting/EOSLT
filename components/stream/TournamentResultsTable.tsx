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

  const rowCount = TOURNAMENT_RESULTS_ROW_PLACEMENTS.length;

  return (
    <div className={overlay ? "text-base text-slate-100" : "text-sm text-slate-200"}>
      <table
        className="w-full table-fixed border-collapse"
        aria-label="Tournament results"
      >
        <tbody>
          {TOURNAMENT_RESULTS_ROW_PLACEMENTS.map((placementLabel, i) => {
            const isLast = i === rowCount - 1;
            const cellY = isLast ? "pt-2 pb-0" : "py-2";
            return (
              <tr key={`result-row-${i}`}>
                <td
                  className={`w-[42%] pr-3 align-middle text-slate-400 lg:w-[40%] ${cellY} ${overlay ? "text-xl" : "text-lg"}`}
                >
                  {placementLabel}
                </td>
                <td
                  className={`${cellY} align-middle font-medium leading-snug text-slate-100 ${overlay ? "text-xl" : "text-[1.094rem]"}`}
                >
                  {assignedNames[i] ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
