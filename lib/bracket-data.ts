import type { BracketData, Match, Round, Slot } from "@/types/bracket";

/** Standard 8-player single-elimination first-round pairs: 1v8, 4v5, 2v7, 3v6. */
const ROUND1_PAIRS_8: [number, number][] = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
];

/**
 * Standard 64-player single-elimination first-round pairs: 1v64, 32v33, 16v49, etc.
 */
const ROUND1_PAIRS_64: [number, number][] = [
  [1, 64], [32, 33], [16, 49], [17, 48], [8, 57], [25, 40], [9, 56], [24, 41],
  [4, 61], [29, 36], [13, 52], [20, 45], [5, 60], [28, 37], [12, 53], [21, 44],
  [2, 63], [31, 34], [15, 50], [18, 47], [7, 58], [26, 39], [10, 55], [23, 42],
  [3, 62], [30, 35], [14, 51], [19, 46], [6, 59], [27, 38], [11, 54], [22, 43],
];

function slot(seed: number, name: string, raceTo: number): Slot {
  return { seed, name, raceTo };
}

function placeholderName(seed: number): string {
  return `Player ${seed}`;
}

/**
 * Build 8-player single-elimination bracket with placeholder names.
 * Round 1: 4 matches, Round 2 (Semi-Final): 2, Round 3 (Final): 1, then Champion.
 */
export function build8Bracket(
  defaultScoreTo: number = 7,
  names?: Map<number, string>
): BracketData {
  const getName = (seed: number) => names?.get(seed) ?? placeholderName(seed);

  const round1Matches: Match[] = [];
  for (let i = 0; i < 4; i++) {
    const [t, b] = ROUND1_PAIRS_8[i];
    round1Matches.push({
      id: `r1-m${i}`,
      top: slot(t, getName(t), defaultScoreTo),
      bottom: slot(b, getName(b), defaultScoreTo),
    });
  }

  const rounds: Round[] = [
    { roundNumber: 1, name: "Round 1", matches: round1Matches },
  ];

  const round2Matches: Match[] = [];
  for (let i = 0; i < 2; i++) {
    round2Matches.push({
      id: `r2-m${i}`,
      top: slot(0, "—", defaultScoreTo),
      bottom: slot(0, "—", defaultScoreTo),
    });
  }
  rounds.push({ roundNumber: 2, name: "Semi-Final", matches: round2Matches });

  rounds.push({
    roundNumber: 3,
    name: "Final",
    matches: [
      {
        id: "r3-m0",
        top: slot(0, "—", defaultScoreTo),
        bottom: slot(0, "—", defaultScoreTo),
      },
    ],
  });

  return { rounds };
}

/**
 * Build 64-player single-elimination bracket with placeholder names.
 * Round 1 has 32 matches, then 16, 8, 4, 2, 1. Default scoreTo is 7.
 */
export function build64Bracket(
  defaultScoreTo: number = 7,
  names?: Map<number, string>
): BracketData {
  const getName = (seed: number) => names?.get(seed) ?? placeholderName(seed);

  const round1Matches: Match[] = [];
  for (let i = 0; i < 32; i++) {
    const [t, b] = ROUND1_PAIRS_64[i];
    round1Matches.push({
      id: `r1-m${i}`,
      top: slot(t, getName(t), defaultScoreTo),
      bottom: slot(b, getName(b), defaultScoreTo),
    });
  }

  const rounds: Round[] = [
    { roundNumber: 1, name: "Round 1", matches: round1Matches },
  ];

  let prevMatches = round1Matches;
  const roundNames = ["Round 2", "Round 3", "Round 4", "Semi-Final", "Final"];
  for (let r = 2; r <= 6; r++) {
    const matchCount = 32 >> r; // 16, 8, 4, 2, 1
    const matches: Match[] = [];
    for (let i = 0; i < matchCount; i++) {
      const topSeed = 0; // placeholder; winner would come from prev round
      const bottomSeed = 0;
      matches.push({
        id: `r${r}-m${i}`,
        top: slot(topSeed, "—", defaultScoreTo),
        bottom: slot(bottomSeed, "—", defaultScoreTo),
      });
    }
    rounds.push({
      roundNumber: r,
      name: roundNames[r - 2],
      matches,
    });
    prevMatches = matches;
  }

  return { rounds };
}
