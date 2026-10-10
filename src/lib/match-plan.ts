// Kampoppsett for en gruppe. Ren logikk uten database.

/** Spilleren er vinner eller taper av en tidligere kamp i gruppen. */
export type MatchSource = { match: number; result: "winner" | "loser" };
/** Spilleren er nr. 1 eller 2 i pulje A (bare i grupper på 5). */
export type PoolSource = { pool: "A"; rank: 1 | 2 };
export type Source = MatchSource | PoolSource;

/** En planlagt kamp. En spiller er enten kjent (id) eller kommer fra en kilde. */
export type PlannedMatch = {
  number: number;
  player1: number | Source;
  player2: number | Source;
  pool?: "A" | "B";
};

/**
 * Kampene i en gruppe, med spillerne sortert etter ranking (beste først).
 *
 * - 4 spillere: 1 mot 4 og 2 mot 3, deretter vinner mot vinner og taper mot taper.
 * - 3 spillere: alle mot alle, 1–2, 2–3, 1–3, så ingen spiller tre kamper på rad.
 * - 5 spillere: slangefordeling i pulje A (1, 4, 5) og pulje B (2, 3). A spiller alle mot
 *   alle, B én kamp. Så spiller nr. 1 i A mot vinner av B om 1. plass, og nr. 2 i A mot
 *   taper av B om 3. plass. Nr. 3 i A blir nr. 5.
 * - Andre størrelser (kan oppstå når admin redigerer grupper): alle mot alle.
 */
export function planGroupMatches(players: number[]): PlannedMatch[] {
  if (players.length === 4) {
    const [p1, p2, p3, p4] = players;
    return [
      { number: 1, player1: p1, player2: p4 },
      { number: 2, player1: p2, player2: p3 },
      { number: 3, player1: { match: 1, result: "winner" }, player2: { match: 2, result: "winner" } },
      { number: 4, player1: { match: 1, result: "loser" }, player2: { match: 2, result: "loser" } },
    ];
  }

  if (players.length === 3) {
    const [p1, p2, p3] = players;
    return [
      { number: 1, player1: p1, player2: p2 },
      { number: 2, player1: p2, player2: p3 },
      { number: 3, player1: p1, player2: p3 },
    ];
  }

  if (players.length === 5) {
    const [p1, p2, p3, p4, p5] = players;
    return [
      { number: 1, player1: p1, player2: p4, pool: "A" },
      { number: 2, player1: p2, player2: p3, pool: "B" },
      { number: 3, player1: p4, player2: p5, pool: "A" },
      { number: 4, player1: p1, player2: p5, pool: "A" },
      { number: 5, player1: { pool: "A", rank: 1 }, player2: { match: 2, result: "winner" } },
      { number: 6, player1: { pool: "A", rank: 2 }, player2: { match: 2, result: "loser" } },
    ];
  }

  const pairs: PlannedMatch[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      pairs.push({ number: pairs.length + 1, player1: players[i], player2: players[j] });
    }
  }
  return pairs;
}

export const isPoolSource = (source: Source): source is PoolSource => "pool" in source;

/** F.eks. «Vinner av kamp 1» eller «Nr. 1 i pulje A». */
export function describeSource(source: Source): string {
  if (isPoolSource(source)) return `Nr. ${source.rank} i pulje ${source.pool}`;
  return `${source.result === "winner" ? "Vinner" : "Taper"} av kamp ${source.match}`;
}
