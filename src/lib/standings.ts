// Sluttstilling i grupper, resultatliste for runden og ny ranking. Ren logikk uten database.

export type StandingMatch = {
  number: number;
  player1Id: number | null;
  player2Id: number | null;
  player1Games: number | null;
  player2Games: number | null;
  winnerId: number | null;
  /** Pulje i grupper på 5 ("A" eller "B"), ellers null. */
  pool?: string | null;
};

export type Standing = {
  playerId: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
};

/** Seire, tap og sett for hver spiller, ut fra kampene som har resultat. */
function tally(players: number[], matches: StandingMatch[]): Map<number, Standing> {
  const stats = new Map(
    players.map((id) => [id, { playerId: id, wins: 0, losses: 0, setsWon: 0, setsLost: 0 }]),
  );
  for (const m of matches) {
    if (m.winnerId === null || m.player1Games === null || m.player2Games === null) continue;
    const p1 = stats.get(m.player1Id!);
    const p2 = stats.get(m.player2Id!);
    if (!p1 || !p2) continue;
    p1.setsWon += m.player1Games;
    p1.setsLost += m.player2Games;
    p2.setsWon += m.player2Games;
    p2.setsLost += m.player1Games;
    const [winner, loser] = m.winnerId === m.player1Id ? [p1, p2] : [p2, p1];
    winner.wins++;
    loser.losses++;
  }
  return stats;
}

/**
 * Rekkefølgen i pulje A i en gruppe på 5, eller null hvis ikke alle A-kampene har resultat.
 * `seeds` er gruppens spillere i seed-rekkefølge; spillerne i pulje A plukkes ut av dem.
 */
export function poolARanking(seeds: number[], matches: StandingMatch[]): number[] | null {
  const pool = matches.filter((m) => m.pool === "A");
  if (pool.length === 0 || pool.some((m) => m.winnerId === null)) return null;
  const players = seeds.filter((id) => pool.some((m) => m.player1Id === id || m.player2Id === id));
  return groupStandings(players, pool).map((s) => s.playerId);
}

/**
 * Sluttstillingen i en gruppe, beste først. `seeds` er spillerne i rekkefølgen de ble
 * seedet (etter ranking før runden).
 *
 * - Gruppe på 4 der kamp 3 og 4 er spilt: vinner og taper av kamp 3 (vinnerkampen),
 *   så vinner og taper av kamp 4 (taperkampen).
 * - Gruppe på 5 der kamp 5 og 6 er spilt: vinner og taper av kamp 5, vinner og taper av
 *   kamp 6, og til slutt nr. 3 i pulje A.
 * - Ellers (grupper på 3, og 4- og 5-grupper som ikke er ferdigspilt): flest seire,
 *   best settdifferanse, flest vunne sett, innbyrdes oppgjør mellom to like, og til slutt seed.
 */
export function groupStandings(seeds: number[], matches: StandingMatch[]): Standing[] {
  const stats = tally(seeds, matches);

  if (seeds.length === 4) {
    const final = matches.find((m) => m.number === 3);
    const consolation = matches.find((m) => m.number === 4);
    if (final?.winnerId && consolation?.winnerId) {
      const loserOf = (m: StandingMatch) => (m.winnerId === m.player1Id ? m.player2Id! : m.player1Id!);
      return [final.winnerId, loserOf(final), consolation.winnerId, loserOf(consolation)].map(
        (id) => stats.get(id)!,
      );
    }
  }

  if (seeds.length === 5) {
    const forFirst = matches.find((m) => m.number === 5);
    const forThird = matches.find((m) => m.number === 6);
    const poolA = poolARanking(seeds, matches);
    if (forFirst?.winnerId && forThird?.winnerId && poolA) {
      const loserOf = (m: StandingMatch) => (m.winnerId === m.player1Id ? m.player2Id! : m.player1Id!);
      return [forFirst.winnerId, loserOf(forFirst), forThird.winnerId, loserOf(forThird), poolA[2]].map(
        (id) => stats.get(id)!,
      );
    }
  }

  const seedOf = (id: number) => seeds.indexOf(id);
  const headToHead = (a: number, b: number) => {
    const m = matches.find(
      (x) =>
        x.winnerId !== null &&
        ((x.player1Id === a && x.player2Id === b) || (x.player1Id === b && x.player2Id === a)),
    );
    return m ? (m.winnerId === a ? -1 : 1) : 0;
  };

  return [...stats.values()].sort((a, b) => {
    const tied = (x: Standing) => [x.wins, x.setsWon - x.setsLost, x.setsWon] as const;
    const [aw, ad, as] = tied(a);
    const [bw, bd, bs] = tied(b);
    if (aw !== bw) return bw - aw;
    if (ad !== bd) return bd - ad;
    if (as !== bs) return bs - as;
    return headToHead(a.playerId, b.playerId) || seedOf(a.playerId) - seedOf(b.playerId);
  });
}

/**
 * Resultatlisten for runden: gruppene etter hverandre, men ved hver gruppegrense
 * bytter sistemann i gruppen over og vinneren av gruppen under plass.
 * G1 [a1, a2, a3, a4] og G2 [b1, b2, b3] gir a1, a2, a3, b1, a4, b2, b3.
 */
export function resultOrder<T>(groups: T[][]): T[] {
  const list = groups.flat();
  let end = -1;
  for (let g = 0; g < groups.length - 1; g++) {
    end += groups[g].length;
    if (groups[g].length > 0 && groups[g + 1].length > 0) {
      [list[end], list[end + 1]] = [list[end + 1], list[end]];
    }
  }
  return list;
}

/**
 * Ny ranking etter runden, som spiller-id-er fra plass 1 og nedover.
 *
 * - `ranked`: aktive spillere med ranking, i dagens rekkefølge.
 * - `results`: deltakerne i resultatlistens rekkefølge.
 *
 * Spillere som ikke var med, rykker 2 plasser ned. Plassene som blir igjen, fordeles på
 * deltakerne i resultatlistens rekkefølge, så deltakerne bytter plass etter resultatet.
 * Deltakere uten ranking får plass nederst før fordelingen.
 */
export function newRanking(ranked: number[], results: number[]): number[] {
  const participants = new Set(results);
  const all = [...ranked, ...results.filter((id) => !ranked.includes(id))];
  const slots: (number | null)[] = all.map(() => null);

  // Nedenfra og opp, så de som står over beholder innbyrdes rekkefølge når de
  // hoper seg opp nederst: er plassen to hakk ned tatt, brukes nærmeste ledige over den.
  for (let index = all.length - 1; index >= 0; index--) {
    const id = all[index];
    if (participants.has(id)) continue;
    let target = Math.min(index + 2, slots.length - 1);
    while (slots[target] !== null) target--;
    slots[target] = id;
  }

  const queue = [...results];
  return slots.map((id) => id ?? queue.shift()!);
}

/**
 * Som newRanking, men spillerne i `kept` beholder plassen sin. Brukes for kvinner som spilte
 * dameliga i runden: de rykker verken opp eller ned i «Alle», og de andre fordeles rundt dem.
 */
export function newRankingKeeping(ranked: number[], results: number[], kept: Set<number>): number[] {
  const fixed = ranked.flatMap((id, index) => (kept.has(id) ? [{ id, index }] : []));
  const order = newRanking(
    ranked.filter((id) => !kept.has(id)),
    results.filter((id) => !kept.has(id)),
  );
  for (const { id, index } of fixed) order.splice(Math.min(index, order.length), 0, id);
  return order;
}
