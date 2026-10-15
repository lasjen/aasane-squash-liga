// Regler for å dele spillerne i en runde inn i grupper. Ren logikk uten database,
// så den kan brukes både på serveren og i visningen.

/** Maks antall spillere i en runde. De som melder seg på etter dette, står på venteliste. */
export const MAX_PLAYERS = 16;
export const MIN_PLAYERS = 4;

/**
 * Gruppestørrelser for `count` spillere, fra gruppe 1 og nedover, eller null hvis
 * antallet ikke lar seg dele i grupper på 3 og 4.
 *
 * Antall grupper er count / 4 rundet opp, og spillerne fordeles så jevnt som mulig.
 * De største gruppene kommer først: 7 → [4, 3], 10 → [4, 3, 3], 16 → [4, 4, 4, 4].
 * 5 spillere blir én gruppe på 5 med eget oppsett (se planGroupMatches).
 * Færre enn 4 går ikke.
 */
export function groupSizes(count: number): number[] | null {
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) return null;
  if (count === 5) return [5];
  const groups = Math.ceil(count / 4);
  const small = Math.floor(count / groups);
  if (small < 3) return null;
  const bigGroups = count % groups;
  return Array.from({ length: groups }, (_, i) => (i < bigGroups ? small + 1 : small));
}

/** Forklaring til admin når runden ikke kan startes med dette antallet, ellers null. */
export function groupSizeProblem(count: number): string | null {
  if (count < MIN_PLAYERS) return `Det trengs minst ${MIN_PLAYERS} spillere for å starte runden.`;
  if (count > MAX_PLAYERS) return `Det kan være maks ${MAX_PLAYERS} spillere i en runde.`;
  if (!groupSizes(count)) {
    return `${count} spillere kan ikke deles i grupper. Legg til eller fjern en spiller.`;
  }
  return null;
}

/** Deler spillere (sortert med best først) i grupper etter `groupSizes`. */
export function splitIntoGroups<T>(players: T[]): T[][] | null {
  const sizes = groupSizes(players.length);
  if (!sizes) return null;
  let start = 0;
  return sizes.map((size) => players.slice(start, (start += size)));
}
