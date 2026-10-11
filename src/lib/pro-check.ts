import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Gender } from "@/lib/player-options";
import { getNationalRanking, type RankedPlayer, type RankingGender } from "@/lib/rankedin";
import { getProRequirement, type ProRequirement } from "@/lib/settings";

/** Hvilke lister spilleren kan finnes i, ut fra kjønnet de har oppgitt. */
function listsFor(gender: Gender | null): RankingGender[] {
  if (gender === "male") return ["male"];
  if (gender === "female") return ["female"];
  return ["male", "female"];
}

/**
 * Spilleren i listene, med beste plassering. Noen damer står også på herrerankingen,
 * så en spiller med kjønn «Annet» kan finnes i begge.
 */
function bestMatch(lists: RankedPlayer[][], rankedinId: string) {
  return lists
    .flat()
    .filter((p) => p.rankedinId === rankedinId)
    .sort((a, b) => a.standing - b.standing)[0];
}

/** De som kan velge Proff: topp N herrer og topp M damer. Kaster feil hvis RankedIn ikke svarer. */
export async function getProCandidates(req: ProRequirement) {
  const [men, women] = await Promise.all([
    getNationalRanking("male", req.menTop),
    getNationalRanking("female", req.womenTop),
  ]);
  return { men, women };
}

/** Felter som lagres på spilleren for proff-kravet. */
export type ProFields = {
  rankedinId: string | null;
  rankedinStanding: number | null;
  rankedinCheckedAt: Date | null;
  proCheckStatus: "ok" | "below" | "unchecked" | "manual" | null;
};

export const NO_PRO_FIELDS: ProFields = {
  rankedinId: null,
  rankedinStanding: null,
  rankedinCheckedAt: null,
  proCheckStatus: null,
};

const limitText = (req: ProRequirement, gender: Gender | null) =>
  gender === "male"
    ? `de ${req.menTop} beste herrene`
    : gender === "female"
      ? `de ${req.womenTop} beste damene`
      : `de ${req.menTop} beste herrene eller de ${req.womenTop} beste damene`;

/**
 * Sjekker at en spiller som velger Proff er innenfor grensen på norgesrankingen.
 * Svarer ikke RankedIn, godtas valget og merkes «ikke kontrollert», så registreringen
 * ikke stopper. `allowWithout` lar admin sette Proff uten RankedIn-valg.
 */
export async function checkProClaim(
  req: ProRequirement,
  gender: Gender | null,
  rankedinId: string | null,
  { allowWithout = false } = {},
): Promise<{ ok: true; fields: ProFields } | { ok: false; error: string }> {
  let lists: RankedPlayer[][];
  try {
    const { men, women } = await getProCandidates(req);
    lists = listsFor(gender).map((g) => (g === "male" ? men : women));
  } catch {
    return {
      ok: true,
      fields: {
        rankedinId,
        rankedinStanding: null,
        rankedinCheckedAt: null,
        proCheckStatus: rankedinId || !allowWithout ? "unchecked" : "manual",
      },
    };
  }

  if (!rankedinId) {
    if (allowWithout) return { ok: true, fields: { ...NO_PRO_FIELDS, proCheckStatus: "manual" } };
    return {
      ok: false,
      error: `Proff krever at du er blant ${limitText(req, gender)} på norgesrankingen. Velg deg selv i listen, eller velg et annet nivå.`,
    };
  }

  const match = bestMatch(lists, rankedinId);
  if (!match) {
    return {
      ok: false,
      error: `Spilleren du valgte er ikke blant ${limitText(req, gender)} på norgesrankingen. Velg et annet nivå.`,
    };
  }
  return {
    ok: true,
    fields: {
      rankedinId,
      rankedinStanding: match.standing,
      rankedinCheckedAt: new Date(),
      proCheckStatus: "ok",
    },
  };
}

/**
 * Sjekker alle proff-spillere med RankedIn-ID mot norgesrankingen på nytt. De som har
 * falt utenfor grensen, merkes «below» for admin; de nedgraderes ikke automatisk.
 * Returnerer null hvis RankedIn ikke svarte.
 */
export async function recheckProPlayers(req: ProRequirement) {
  let candidates: { men: RankedPlayer[]; women: RankedPlayer[] };
  try {
    candidates = await getProCandidates(req);
  } catch {
    return null;
  }

  const pros = await db
    .select({ id: schema.players.id, gender: schema.players.gender, rankedinId: schema.players.rankedinId })
    .from(schema.players)
    .where(
      and(
        eq(schema.players.level, "pro"),
        isNotNull(schema.players.rankedinId),
        isNull(schema.players.deletedAt),
      ),
    );

  let below = 0;
  for (const p of pros) {
    const lists = listsFor(p.gender).map((g) => (g === "male" ? candidates.men : candidates.women));
    const match = bestMatch(lists, p.rankedinId!);
    if (!match) below++;
    await db
      .update(schema.players)
      .set({
        rankedinStanding: match?.standing ?? null,
        rankedinCheckedAt: new Date(),
        proCheckStatus: match ? "ok" : "below",
      })
      .where(eq(schema.players.id, p.id));
  }
  return { checked: pros.length, below };
}

/**
 * RankedIn-feltene som skal lagres når en spiller lagres med `level`.
 * - Kravet er av: `fields` er undefined, så feltene ikke røres.
 * - Kravet er på og nivået er ikke Proff: feltene tømmes.
 * - Kravet er på og nivået er Proff: valget sjekkes med checkProClaim.
 */
export async function resolveProFields(
  level: string | null,
  gender: Gender | null,
  rankedinId: string | null,
  options: { allowWithout?: boolean } = {},
): Promise<{ ok: true; fields?: ProFields } | { ok: false; error: string }> {
  const req = await getProRequirement();
  if (!req.enabled) return { ok: true };
  if (level !== "pro") return { ok: true, fields: NO_PRO_FIELDS };
  return checkProClaim(req, gender, rankedinId, options);
}
