export type ScoreboardState = {
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
};

export const DEFAULT_STREAM_OBS_HOST = "192.168.1.100";
export const DEFAULT_STREAM_OBS_PORT = "4455";

export const DEFAULT_SCOREBOARD: ScoreboardState = {
  awayName: "Team A",
  homeName: "Team B",
  awayScore: 0,
  homeScore: 0,
};

export function parseScoreboardJson(json: string | undefined | null): ScoreboardState {
  if (!json?.trim()) return DEFAULT_SCOREBOARD;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return {
      awayName: typeof o.awayName === "string" ? o.awayName : DEFAULT_SCOREBOARD.awayName,
      homeName: typeof o.homeName === "string" ? o.homeName : DEFAULT_SCOREBOARD.homeName,
      awayScore:
        typeof o.awayScore === "number"
          ? o.awayScore
          : Number(o.awayScore) || DEFAULT_SCOREBOARD.awayScore,
      homeScore:
        typeof o.homeScore === "number"
          ? o.homeScore
          : Number(o.homeScore) || DEFAULT_SCOREBOARD.homeScore,
    };
  } catch {
    return DEFAULT_SCOREBOARD;
  }
}
