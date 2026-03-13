"use client";

import type { Match } from "@/types/bracket";

/**
 * Single match: two slots (top/bottom), each with seed + name and their own race-to.
 * "Race" label sits above the matchup card above the race column.
 */
export function MatchBox({ match }: { match: Match }) {
  return (
    <div className="flex min-w-[200px] flex-col overflow-hidden rounded-lg border border-black bg-sky-900/90 shadow">
      <div className="flex border-b border-black bg-sky-800/70 py-1">
        <div className="flex flex-1 items-center border-r border-black px-2">
          <span className="text-[10px] font-medium text-sky-300">
            Location TBD
          </span>
        </div>
        <div className="flex w-12 shrink-0 items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-sky-300">
            Race
          </span>
        </div>
      </div>
      <div className="flex items-stretch">
        <div className="flex flex-1 flex-col">
          <div className="flex min-h-[36px] items-stretch">
            <div className="flex w-6 shrink-0 items-center justify-center rounded-tl-[5px] border border-l-0 border-t-0 border-black bg-white text-xs font-medium text-black">
              {match.top.seed}
            </div>
            <div className="flex min-w-0 flex-1 items-center truncate border-b border-r border-black py-1.5 pl-2">
              <span className="truncate text-sm text-white">{match.top.name}</span>
            </div>
          </div>
          <div className="flex min-h-[36px] items-stretch">
            <div className="flex w-6 shrink-0 items-center justify-center rounded-bl-lg border border-l-0 border-t-0 border-black bg-white text-xs font-medium text-black">
              {match.bottom.seed}
            </div>
            <div className="flex min-w-0 flex-1 items-center truncate border-r border-black py-1.5 pl-2">
              <span className="truncate text-sm text-white">{match.bottom.name}</span>
            </div>
          </div>
        </div>
        <div className="flex w-12 shrink-0 flex-col">
          <div className="flex min-h-[36px] items-center justify-center rounded-tr-[5px] border border-black border-l-0 border-t-0 px-1 bg-white">
            <span className="text-base font-bold text-black tabular-nums">
              {match.top.raceTo}
            </span>
          </div>
          <div className="flex min-h-[36px] items-center justify-center rounded-br-lg border border-t-0 border-black border-l-0 bg-white px-1">
            <span className="text-base font-bold text-black tabular-nums">
              {match.bottom.raceTo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
