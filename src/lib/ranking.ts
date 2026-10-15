import { LEVELS, type Level } from "@/lib/player-options";

type RankablePlayer = { id: number; ranking: number | null; level: Level | null };

/** Nivåene fra best til svakest. Spillere uten nivå kommer etter disse. */
const LEVELS_BEST_FIRST = [...LEVELS].reverse();

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Ny rankingrekkefølge, som spiller-id-er fra plass 1 og nedover.
 *
 * - Spillere som allerede har ranking beholder rekkefølgen sin, og hull tettes.
 * - Spillere uten ranking legges under dem, sortert på nivå (proff først).
 *   Spillere uten nivå kommer sist. Innen hvert nivå er rekkefølgen tilfeldig.
 *
 * Har ingen ranking fra før, blir hele rankingen laget ut fra nivå.
 */
export function buildRanking(players: RankablePlayer[], random: () => number = Math.random): number[] {
  const ranked = players
    .filter((p) => p.ranking !== null)
    .sort((a, b) => a.ranking! - b.ranking! || a.id - b.id);
  const unranked = players.filter((p) => p.ranking === null);

  const groups = [...LEVELS_BEST_FIRST, null].map((level) =>
    shuffle(
      unranked.filter((p) => p.level === level),
      random,
    ),
  );

  return [...ranked, ...groups.flat()].map((p) => p.id);
}

/** Om to rekkefølger inneholder nøyaktig de samme spillerne, uten duplikater. */
export function sameRankingMembers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return set.size === a.length && new Set(b).size === b.length && b.every((id) => set.has(id));
}

/**
 * Hvem som har fått ny plass når rankingen endres fra `before` til `after`
 * (begge er spiller-id-er fra plass 1 og nedover), sortert på ny plass.
 */
export function rankingMoves(before: number[], after: number[]) {
  const oldPlace = new Map(before.map((id, i) => [id, i + 1]));
  return after
    .map((id, i) => ({ id, from: oldPlace.get(id) ?? null, to: i + 1 }))
    .filter((m) => m.from !== m.to);
}
