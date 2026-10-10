// Regler for kampresultat. Runden spilles best av 3 eller best av 5 sett.

export const BEST_OF_OPTIONS = [3, 5] as const;
export type BestOf = (typeof BEST_OF_OPTIONS)[number];
export const DEFAULT_BEST_OF: BestOf = 3;

/** Antall sett vinneren må ta: 2 i best av 3, 3 i best av 5. */
export const setsToWin = (bestOf: number) => Math.floor(bestOf / 2) + 1;

/** Tolker antall vunne sett fra et skjema. Gir feilmelding hvis resultatet ikke er gyldig. */
export function parseScore(
  player1: unknown,
  player2: unknown,
  bestOf: number,
): { ok: true; player1Games: number; player2Games: number } | { ok: false; error: string } {
  const toWin = setsToWin(bestOf);
  const a = Number(player1);
  const b = Number(player2);
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= toWin)) {
    return { ok: false, error: "Velg antall sett for begge spillerne." };
  }
  if ((a === toWin) === (b === toWin)) {
    return {
      ok: false,
      error: `Én av spillerne må ha vunnet ${toWin} sett, f.eks. ${toWin}–${toWin - 1}.`,
    };
  }
  return { ok: true, player1Games: a, player2Games: b };
}
