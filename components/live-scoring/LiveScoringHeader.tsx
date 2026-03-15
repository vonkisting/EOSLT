"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Slot indices for a matchup: matchIndex 0->0,1; 1->2,3; ...; 5->10,11. */
function slotIndicesForMatch(matchIndex: number): [number, number] {
  const top = matchIndex < 4 ? matchIndex * 2 : 8 + (matchIndex - 4) * 2;
  return [top, top + 1];
}

/** Split "First Last" into ["First", "Last"] for display; single name stays one line. */
function splitDisplayName(fullName: string): [string, string] {
  const t = fullName.trim();
  if (!t) return ["", ""];
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return [t, ""];
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return [first, last];
}

const AVATAR_NEUTRAL = "/avatars/neutral.svg";

type UserRow = {
  _id: string;
  email: string;
  name: string | null;
  image: string | null;
  poolhubPlayerName: string | null;
};

/** Returns profile image URL if set, otherwise the gender-neutral avatar bust. */
function avatarUrlForPlayer(
  playerName: string,
  users: UserRow[] | undefined
): string {
  if (!users || !playerName.trim()) return AVATAR_NEUTRAL;
  const norm = playerName.trim().toLowerCase();
  const u = users.find(
    (x) => (x.poolhubPlayerName ?? "").trim().toLowerCase() === norm
  );
  return u?.image ?? AVATAR_NEUTRAL;
}


export function LiveScoringHeader({
  cardIndex,
  matchIndex,
}: {
  cardIndex: number;
  matchIndex: number;
}) {
  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase().trim();
  const settings = useQuery(
    api.dashboardSettings.get,
    email ? { email } : "skip"
  );
  const users = useQuery(api.users.list, {});

  const { player1Name, player2Name, player1AvatarUrl, player2AvatarUrl } =
    useMemo(() => {
      const s = settings as Record<string, unknown> | undefined;
      if (s == null) {
        return {
          player1Name: "",
          player2Name: "",
          player1AvatarUrl: AVATAR_NEUTRAL,
          player2AvatarUrl: AVATAR_NEUTRAL,
        };
      }
      const base = cardIndex * 12;
      const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
      const p1 = (s[`bracketSlot${base + topSlot}`] as string) ?? "";
      const p2 = (s[`bracketSlot${base + bottomSlot}`] as string) ?? "";
      const userList = users as UserRow[] | undefined;
      return {
        player1Name: (p1 || "").trim() || "TBD",
        player2Name: (p2 || "").trim() || "TBD",
        player1AvatarUrl: avatarUrlForPlayer(p1, userList),
        player2AvatarUrl: avatarUrlForPlayer(p2, userList),
      };
    }, [settings, users, cardIndex, matchIndex]);

  const [p1First, p1Last] = splitDisplayName(player1Name);
  const [p2First, p2Last] = splitDisplayName(player2Name);

  return (
    <header
      className="rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-slate-900/95 via-[#0f172a] to-slate-900/95 px-6 py-8 shadow-lg"
      aria-label="Matchup"
    >
      <div className="flex flex-wrap items-center justify-between gap-8 sm:gap-12">
        {/* Player 1 */}
        <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-3 text-center">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/10 bg-slate-800/80 shadow-inner ring-2 ring-white/5">
            <span
              className="block h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${player1AvatarUrl})` }}
              role="img"
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-tight text-white">
              {p1First}
            </p>
            {p1Last ? (
              <p className="truncate text-sm font-medium text-slate-400">
                {p1Last}
              </p>
            ) : null}
          </div>
        </div>

        {/* VS */}
        <div
          className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold uppercase tracking-widest text-slate-400"
          aria-hidden
        >
          VS
        </div>

        {/* Player 2 */}
        <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-3 text-center">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/10 bg-slate-800/80 shadow-inner ring-2 ring-white/5">
            <span
              className="block h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${player2AvatarUrl})` }}
              role="img"
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-tight text-white">
              {p2First}
            </p>
            {p2Last ? (
              <p className="truncate text-sm font-medium text-slate-400">
                {p2Last}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
