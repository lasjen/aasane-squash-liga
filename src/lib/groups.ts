// Regler for å dele spillerne i en runde inn i grupper. Ren logikk uten database,
// så den kan brukes både på serveren og i visningen.

/**
 * Maks antall spillere i en runde før admin har endret det under Innstillinger.
 * De som melder seg på etter dette, står på venteliste. Se getLeagueSettings.
 */
export const DEFAULT_MAX_PLAYERS = 16;
export const MIN_PLAYERS = 4;
/** Grensene admin kan sette maks antall spillere innenfor. */
export const MAX_PLAYERS_LIMIT = 64;
/**
 * Minste antall i en liga når runden deles i «Alle» og dameliga. Da holder en gruppe på 3.
 * Se planRoundGroups i src/lib/leagues.ts.
 */
export const MIN_LEAGUE_PLAYERS = 3;

/**
 * Gruppestørrelser for `count` spillere, fra gruppe 1 og nedover, eller null hvis
 * antallet ikke lar seg dele i grupper på 3 og 4.
 *
 * Antall grupper er count / 4 rundet opp, og spillerne fordeles så jevnt som mulig.
 * De største gruppene kommer først: 7 → [4, 3], 10 → [4, 3, 3], 16 → [4, 4, 4, 4].
 * 5 spillere blir én gruppe på 5 med eget oppsett (se planGroupMatches).
 * Færre enn `min` (vanligvis 4) går ikke.
 */
export function groupSizes(count: number, min: number = MIN_PLAYERS): number[] | null {
  if (count < min) return null;
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
  if (!groupSizes(count)) {
    return `${count} spillere kan ikke deles i grupper. Legg til eller fjern en spiller.`;
  }
  return null;
}

/** Deler spillere (sortert med best først) i grupper etter `groupSizes`. */
export function splitIntoGroups<T>(players: T[], min: number = MIN_PLAYERS): T[][] | null {
  const sizes = groupSizes(players.length, min);
  if (!sizes) return null;
  let start = 0;
  return sizes.map((size) => players.slice(start, (start += size)));
}
