/**
 * Types for single-elimination bracket (e.g. 64-player pool).
 */

export type Slot = {
  seed: number;
  name: string;
  /** Race-to number for this player (e.g. 7). */
  raceTo: number;
};

export type Match = {
  id: string;
  top: Slot;
  bottom: Slot;
};

export type Round = {
  roundNumber: number;
  name: string;
  matches: Match[];
};

export type BracketData = {
  rounds: Round[];
};
