// Ligaene i torsdagsligaen: «Alle», der alle er med, og dameligaen. Ren logikk uten database,
// og bare relative importer, så filen kan brukes av datamodellen, serveren og skjemaene.

import { MIN_LEAGUE_PLAYERS, splitIntoGroups } from "./groups";

/** `open` er «Alle», `women` er dameligaen. */
export const LEAGUES = ["open", "women"] as const;
export type League = (typeof LEAGUES)[number];

/** Navnet på rankingen/fanen. */
export const LEAGUE_LABELS: Record<League, string> = {
  open: "Alle",
  women: "Kvinner",
};

/** Teksten på sjekkboksen kvinner kan krysse av. */
export const WOMENS_LEAGUE_CHECKBOX_LABEL = "Ønsker å spille dameliga (hvis nok spillere)";

/** Så mange kvinner som må ønske dameliga i en runde før det blir egne damegrupper. */
export const MIN_WOMENS_LEAGUE_PLAYERS = MIN_LEAGUE_PLAYERS;

/** Navnet på en gruppe, f.eks. «Gruppe 2» eller «Damegruppe 1». */
export function groupLabel(league: League, number: number) {
  return league === "women" ? `Damegruppe ${number}` : `Gruppe ${number}`;
}

type WomensLeagueCandidate = {
  gender: string | null;
  wantsWomensLeague: boolean;
  active?: boolean;
  deletedAt?: Date | null;
};

/** Om spilleren er med i dameligaen: aktiv kvinne som har krysset av for dameliga. */
export function isWomensLeagueMember(p: WomensLeagueCandidate) {
  return p.gender === "female" && p.wantsWomensLeague && p.active !== false && !p.deletedAt;
}

/**
 * Hvem som spiller i hvilken liga i en runde. `players` er deltakerne i runden.
 *
 * Er det minst 3 kvinner som vil spille dameliga, spiller de i egne damegrupper, og resten
 * spiller i «Alle». Det forutsetter at resten også kan deles i grupper (ingen, eller minst 3);
 * ellers spiller alle i «Alle» som vanlig, så ingen blir stående uten gruppe.
 */
export function splitLeagues<T extends WomensLeagueCandidate>(players: T[]) {
  const women = players.filter(isWomensLeagueMember);
  const open = players.filter((p) => !isWomensLeagueMember(p));
  const enough =
    women.length >= MIN_WOMENS_LEAGUE_PLAYERS && (open.length === 0 || open.length >= MIN_LEAGUE_PLAYERS);
  return enough ? { open, women } : { open: players, women: [] as T[] };
}

/**
 * Gruppene i en runde per liga, med spillerne sortert med best først innen hver liga
 * (`compareOpen` og `compareWomen` bestemmer rekkefølgen). Null hvis «Alle» ikke kan deles
 * i grupper. Når runden er delt, holder 3 spillere i en liga; ellers trengs minst 4.
 */
export function planRoundGroups<T extends WomensLeagueCandidate>(
  players: T[],
  compareOpen: (a: T, b: T) => number,
  compareWomen: (a: T, b: T) => number,
): { open: T[][]; women: T[][] } | null {
  const { open, women } = splitLeagues(players);
  if (women.length === 0) {
    const groups = splitIntoGroups([...open].sort(compareOpen));
    return groups ? { open: groups, women: [] } : null;
  }
  const openGroups = open.length === 0 ? [] : splitIntoGroups([...open].sort(compareOpen), MIN_LEAGUE_PLAYERS);
  const womenGroups = splitIntoGroups([...women].sort(compareWomen), MIN_LEAGUE_PLAYERS);
  return openGroups && womenGroups ? { open: openGroups, women: womenGroups } : null;
}

type RankedCandidate = WomensLeagueCandidate & { ranking: number | null; womenRanking: number | null };

/**
 * Trekningen av gruppene når runden startes: planRoundGroups med «Alle» sortert etter ranking
 * og damegruppene etter dameligaens ranking. `players` er deltakerne i påmeldingsrekkefølge;
 * Array.sort er stabil, så spillere uten ranking kommer sist og beholder den rekkefølgen.
 */
export function planRoundByRanking<T extends RankedCandidate>(players: T[]) {
  const byRanking = (a: T, b: T) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity);
  return planRoundGroups(
    players,
    byRanking,
    (a, b) => (a.womenRanking ?? Infinity) - (b.womenRanking ?? Infinity) || byRanking(a, b),
  );
}
