"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

type OverallPlayerStatsRow = Record<string, string | number | null | undefined>;

function getStatValue(
  row: OverallPlayerStatsRow,
  ...keys: string[]
): string | number | null | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  const lower = keys.map((k) => k.toLowerCase());
  const found = Object.entries(row).find(([k]) => lower.includes(k.toLowerCase()));
  return found ? found[1] : undefined;
}

function toNumber(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function playerDisplayName(row: OverallPlayerStatsRow): string {
  const val = getStatValue(row, "Name", "name", "PlayerName", "Player");
  return val != null && val !== "" ? String(val).trim() : "";
}

/** Same filter as dashboard: only players with more than 7 weeks. */
function rowQualifies(row: OverallPlayerStatsRow): boolean {
  const weeks = toNumber(getStatValue(row, "Weeks", "weeks", "WeeksPlayed"));
  return weeks != null && weeks > 7;
}

/**
 * Client component: lists PoolHub players (same source as dashboard) with a "Link"
 * button. Hides the button for players already linked to an account.
 * Uses userEmail from the server so the correct account is used (avoids stale client session).
 */
export function LinkPlayerList({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const email = userEmail?.trim() || null;
  const settings = useQuery(api.dashboardSettings.get, email ? { email } : "skip");
  const users = useQuery(api.users.list);
  const setPoolhubPlayerName = useMutation(api.users.setPoolhubPlayerName);

  const [leagueGuid, setLeagueGuid] = useState<string | null>(null);
  const [playerRows, setPlayerRows] = useState<OverallPlayerStatsRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [linkingName, setLinkingName] = useState<string | null>(null);
  const [unlinkingName, setUnlinkingName] = useState<string | null>(null);

  const normalizedEmail = email?.toLowerCase().trim() ?? "";

  const hasUsableSettings = Boolean(
    settings && settings.leagueName && settings.season
  );

  const linkedNames = useMemo(() => {
    if (!users) return new Set<string>();
    return new Set(
      users
        .map((u) => u.poolhubPlayerName)
        .filter((n): n is string => n != null && n !== "")
    );
  }, [users]);

  const myLinkedName = useMemo(() => {
    if (!users || !normalizedEmail) return null;
    const me = users.find(
      (u) => (u.email ?? "").toLowerCase().trim() === normalizedEmail
    );
    const name = me?.poolhubPlayerName;
    return name != null && name !== "" ? name : null;
  }, [users, normalizedEmail]);

  const resolveLeagueGuid = useCallback(async (leagueName: string, season: string) => {
    if (!leagueName || !season) return null;
    const params = new URLSearchParams({ leagueName, season });
    const res = await fetch(`/api/players?${params.toString()}`);
    const data = await res.json();
    return data?.leagueGuid ?? null;
  }, []);

  useEffect(() => {
    if (!hasUsableSettings) {
      setLeagueGuid(null);
      setPlayerRows([]);
      return;
    }
    const guid = settings?.leagueGuid ?? null;
    if (guid) {
      setLeagueGuid(guid);
      return;
    }
    const leagueName = settings!.leagueName;
    const season = settings!.season;
    let cancelled = false;
    setLoadingPlayers(true);
    resolveLeagueGuid(leagueName, season).then((resolved) => {
      if (cancelled) return;
      setLeagueGuid(resolved);
      setLoadingPlayers(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hasUsableSettings, settings?.leagueGuid, settings?.leagueName, settings?.season, resolveLeagueGuid]);

  useEffect(() => {
    if (settings === undefined || hasUsableSettings) return;
    let cancelled = false;
    setLoadingFallback(true);
    fetch("/api/leagues")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (cancelled) return;
        const leagues = Array.isArray(data) ? data : [];
        const firstLeague = leagues[0];
        if (!firstLeague) {
          setLoadingFallback(false);
          return;
        }
        return fetch(`/api/seasons?leagueName=${encodeURIComponent(firstLeague)}`)
          .then((r) => r.json())
          .then((seasonsData: string[]) => {
            if (cancelled) return;
            const seasons = Array.isArray(seasonsData) ? seasonsData : [];
            const firstSeason = seasons[0];
            if (!firstSeason) {
              setLoadingFallback(false);
              return;
            }
            return resolveLeagueGuid(firstLeague, firstSeason);
          });
      })
      .then((resolved) => {
        if (cancelled) return;
        if (resolved != null) setLeagueGuid(resolved);
        setLoadingFallback(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingFallback(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings, hasUsableSettings, resolveLeagueGuid]);

  useEffect(() => {
    if (!leagueGuid) {
      setPlayerRows([]);
      return;
    }
    let cancelled = false;
    setLoadingPlayers(true);
    fetch(`/api/overall-player-stats?leagueGuid=${encodeURIComponent(leagueGuid)}`)
      .then((r) => r.json())
      .then((rows: OverallPlayerStatsRow[]) => {
        if (cancelled) return;
        setPlayerRows(Array.isArray(rows) ? rows : []);
        setLoadingPlayers(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPlayerRows([]);
          setLoadingPlayers(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leagueGuid]);

  const handleLink = useCallback(
    async (playerName: string) => {
      if (!email || !playerName.trim()) return;
      setLinkingName(playerName);
      try {
        await setPoolhubPlayerName({ email, poolhubPlayerName: playerName.trim() });
        router.push("/profile");
      } finally {
        setLinkingName(null);
      }
    },
    [email, router, setPoolhubPlayerName]
  );

  const handleUnlink = useCallback(
    async () => {
      if (!email) return;
      setUnlinkingName(myLinkedName ?? null);
      try {
        await setPoolhubPlayerName({ email, poolhubPlayerName: "" });
      } finally {
        setUnlinkingName(null);
      }
    },
    [email, myLinkedName, setPoolhubPlayerName]
  );

  const playerNames = useMemo(() => {
    return playerRows
      .filter(rowQualifies)
      .map((row) => playerDisplayName(row))
      .filter((name) => name !== "")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [playerRows]);

  if (!email) {
    return (
      <div className="text-sm text-blue-200/80">
        Loading…
      </div>
    );
  }

  const settingsLoaded = settings !== undefined;
  const noListYet = !leagueGuid && !loadingFallback && !loadingPlayers;
  const showNeedDashboard =
    settingsLoaded && !hasUsableSettings && noListYet;

  if (showNeedDashboard) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-blue-200/80">
          We use your saved league and season from the Dashboard when you have one. Load your dashboard and select a league and season to save one, or we’ll try to show a list from the first available league.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded bg-gradient-to-r from-purple-700 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:from-purple-600 hover:to-purple-400"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const stillLoading =
    settings === undefined ||
    loadingFallback ||
    (loadingPlayers && playerRows.length === 0);
  if (stillLoading) {
    return (
      <div className="text-sm text-blue-200/80">
        Loading players…
      </div>
    );
  }

  if (playerNames.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-blue-200/80">
          No players found for the current league and season. Try the Dashboard first.
        </p>
        <Link
          href="/profile"
          className="inline-flex items-center justify-center rounded bg-gradient-to-r from-purple-700 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:from-purple-600 hover:to-purple-400"
        >
          ← Back to Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-blue-200/80">
        {myLinkedName
          ? "You are linked to a player. Use Un-Link to unlink, then you can link to a different player."
          : "Select your player name to link this account. Players already linked to another account do not show a Link button."}
      </p>
      <ul className="flex flex-col gap-2 rounded-lg border border-[var(--surface-border)] bg-black/40 p-3 max-h-[60vh] overflow-y-auto">
        {playerNames.map((name) => {
          const isLinkedToMe =
            myLinkedName != null && myLinkedName !== "" && name === myLinkedName;
          const isLinkedToOther = linkedNames.has(name);
          const isLinking = linkingName === name;
          const isUnlinking = unlinkingName === name;
          const showLinkButton =
            !myLinkedName && !isLinkedToOther && !isLinkedToMe;
          return (
            <li
              key={name}
              className="flex items-center justify-between gap-3 rounded border border-transparent bg-slate-900/50 px-3 py-2 text-foreground"
            >
              <span className="font-medium text-blue-100">{name}</span>
              {isLinkedToMe ? (
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="rounded bg-gradient-to-r from-red-700 to-red-500 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:from-red-600 hover:to-red-400 disabled:opacity-50"
                >
                  {isUnlinking ? "Un-linking…" : "Un-Link"}
                </button>
              ) : showLinkButton ? (
                <button
                  type="button"
                  onClick={() => handleLink(name)}
                  disabled={isLinking}
                  className="rounded bg-gradient-to-r from-purple-700 to-purple-500 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:from-purple-600 hover:to-purple-400 disabled:opacity-50"
                >
                  {isLinking ? "Linking…" : "Link"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link
        href="/profile"
        className="inline-flex items-center justify-center rounded bg-gradient-to-r from-purple-700 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:from-purple-600 hover:to-purple-400"
      >
        ← Back to Profile
      </Link>
    </div>
  );
}
