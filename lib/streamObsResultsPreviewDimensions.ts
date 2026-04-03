/**
 * Default width when the preview node cannot be measured (e.g. legacy fallback).
 */
export const RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX = 350;

/**
 * Default height fallback only when measurement is unavailable.
 */
export const RESULTS_PREVIEW_CARD_OUTER_HEIGHT_PX = 580;

/** Reject getBoundingClientRect results below this (collapsed/hidden preview). */
export const RESULTS_PREVIEW_MEASURE_MIN_PX = 48;

export type ResultsPreviewMeasureResult =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: "missing" | "too_small" };

/**
 * Border-box size of the results preview element in CSS pixels (for OBS browser source size).
 */
export function readResultsPreviewOuterDimensionsPx(
  element: HTMLElement | null
): ResultsPreviewMeasureResult {
  if (!element) return { ok: false, reason: "missing" };
  const r = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(r.width));
  const height = Math.max(1, Math.ceil(r.height));
  if (width < RESULTS_PREVIEW_MEASURE_MIN_PX || height < RESULTS_PREVIEW_MEASURE_MIN_PX) {
    return { ok: false, reason: "too_small" };
  }
  return { ok: true, width, height };
}
