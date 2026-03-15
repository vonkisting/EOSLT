"use client";

import { Modal } from "@/components/ui/Modal";

/**
 * Modal shown when a user clicks a matchup on the home screen.
 * Displays the two players, matchup status, and optionally "Start Live Scoring" if the user is a player.
 */
export function MatchupModal({
  open,
  onClose,
  player1Name,
  player2Name,
  statusDisplay,
  showStartButton,
  onStartLiveScoring,
  startLoading,
}: {
  open: boolean;
  onClose: () => void;
  player1Name: string;
  player2Name: string;
  statusDisplay: string;
  showStartButton: boolean;
  onStartLiveScoring: () => void;
  startLoading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Matchup">
      <div className="flex flex-col gap-5">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-slate-400">Players</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {player1Name || "TBD"} vs {player2Name || "TBD"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-slate-400">Status</p>
          <p className="mt-1 text-lg text-white">{statusDisplay}</p>
        </div>
        {showStartButton && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onStartLiveScoring}
              disabled={startLoading}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#2A204A] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {startLoading ? "Starting…" : "Start Live Scoring"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
