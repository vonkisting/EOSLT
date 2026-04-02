/**
 * Map between OBS mixer dB and a 0–100 UI slider (–60 dB … 0 dB → 0 … 100; ≥0 dB → 100).
 */
export function obsVolumeDbToUiPercent(db: number): number {
  if (db >= 0) return 100;
  if (db <= -60) return 0;
  return Math.round(((db + 60) / 60) * 100);
}

export function uiPercentToObsVolumeDb(percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return (p / 100) * 60 - 60;
}
