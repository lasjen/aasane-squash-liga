"use server";

import { redirect } from "next/navigation";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/admin-session";
import { logAction } from "@/lib/audit";
import { isTime } from "@/lib/dates";
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS } from "@/lib/groups";
import { BEST_OF_OPTIONS, type BestOf } from "@/lib/score";

const PAGE = "/admin/innstillinger";

/**
 * Lagrer standardverdiene for ligaen. Maks antall spillere gjelder med en gang, også for
 * påmeldingen som er åpen. Kampformat og klokkeslett gjelder runder som lages etter dette;
 * en runde som allerede finnes, endres under Ligarunde.
 */
export async function saveLeagueSettings(formData: FormData) {
  const actor = await requireAdmin();
  const maxPlayers = Number(formData.get("maxPlayers"));
  const bestOf = Number(formData.get("bestOf"));
  const startsAt = String(formData.get("startsAt") ?? "").slice(0, 5);
  const endsAt = String(formData.get("endsAt") ?? "").slice(0, 5);

  if (!Number.isInteger(maxPlayers) || maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS_LIMIT) {
    redirect(`${PAGE}?melding=ukjent-antall`);
  }
  if (!BEST_OF_OPTIONS.includes(bestOf as BestOf)) redirect(`${PAGE}?melding=ukjent-format`);
  if (!isTime(startsAt) || !isTime(endsAt)) redirect(`${PAGE}?melding=ukjent-tid`);
  if (startsAt >= endsAt) redirect(`${PAGE}?melding=tid-rekkefolge`);

  const values = { maxPlayers, bestOf, startsAt, endsAt, updatedAt: new Date() };
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.leagueSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: schema.leagueSettings.id, set: values });
    await logAction(
      actor,
      "innstillinger.endret",
      `Satte standardverdier: maks ${maxPlayers} spillere, best av ${bestOf} sett, ${startsAt}–${endsAt}`,
      tx,
    );
  });
  redirect(`${PAGE}?melding=lagret`);
}
