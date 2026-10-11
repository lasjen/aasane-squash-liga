"use server";

import { getProCandidates } from "@/lib/pro-check";
import type { RankedPlayer } from "@/lib/rankedin";
import { getProRequirement } from "@/lib/settings";

export type ProOption = { id: string; label: string };
export type ProOptions =
  | { enabled: false }
  | {
      enabled: true;
      menTop: number;
      womenTop: number;
      men: ProOption[];
      women: ProOption[];
      /** Satt hvis norgesrankingen ikke kunne hentes. */
      unavailable?: boolean;
    };

const option = (p: RankedPlayer): ProOption => ({
  id: p.rankedinId,
  label: `${p.standing}. ${p.name}${p.club ? ` (${p.club})` : ""}`,
});

/**
 * Om kravet om norgesranking for Proff er slått på, og i så fall hvem som kan velges.
 * Hentes av skjemaene når spilleren velger nivå Proff. Rankingen er offentlig, så
 * dette krever ikke innlogging (det brukes også ved registrering).
 */
export async function getProOptions(): Promise<ProOptions> {
  const req = await getProRequirement();
  if (!req.enabled) return { enabled: false };
  try {
    const { men, women } = await getProCandidates(req);
    return { enabled: true, menTop: req.menTop, womenTop: req.womenTop, men: men.map(option), women: women.map(option) };
  } catch {
    return { enabled: true, menTop: req.menTop, womenTop: req.womenTop, men: [], women: [], unavailable: true };
  }
}
