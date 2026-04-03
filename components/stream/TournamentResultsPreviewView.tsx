import { TournamentResultsTable } from "@/components/stream/TournamentResultsTable";
import type { TournamentSettingsState } from "@/components/stream/tournamentSettingsDefaults";

type TournamentResultsPreviewViewProps = {
  settings: TournamentSettingsState;
};

/**
 * Dashboard results preview (same grid as OBS overlay; width constrained in parent).
 */
export function TournamentResultsPreviewView({ settings }: TournamentResultsPreviewViewProps) {
  return <TournamentResultsTable settings={settings} variant="dashboard" />;
}
