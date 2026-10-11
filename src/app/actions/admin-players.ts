"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { adminPlayerSchema, type AdminPlayerField } from "@/lib/admin/player-validation";
import { logAction } from "@/lib/audit";
import { requireOperator } from "@/lib/auth/admin-session";
import { hashPassword } from "@/lib/auth/password";
import type { FormState } from "@/lib/auth/validation";
import {
  anonymizePlayer,
  isInRunningRound,
  isLastAdmin,
  removeFromRanking,
  type Transaction,
} from "@/lib/players/delete-player";
import { buildRanking } from "@/lib/ranking";
import { isOperatorRole, ROLE_LABELS, type Role } from "@/lib/roles";

type PlayerFormState = FormState<AdminPlayerField>;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function isUniqueViolation(err: unknown) {
  const cause = err instanceof Error && "cause" in err ? err.cause : err;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

/** Leser skjemaet. Returnerer enten gyldige data eller feil klare for skjemaet. */
function parsePlayerForm(formData: FormData) {
  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    gender: text(formData, "gender"),
    level: text(formData, "level"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    active: formData.get("active") === "on" ? "on" : "",
    // Rollefeltet vises bare for admins. Mangler det, endres ikke rollen.
    role: text(formData, "role"),
  };
  const parsed = adminPlayerSchema.safeParse({
    ...values,
    password: text(formData, "password"),
    active: values.active === "on",
    role: values.role || undefined,
  });
  return { values, parsed };
}

const emailTaken = (values: Record<string, string>): PlayerFormState => ({
  errors: { email: ["En annen spiller har allerede denne e-postadressen."] },
  values,
});

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

/** Spilleren slik den er nå, for tilgangssjekk og logg. */
async function loadPlayer(executor: typeof db | Transaction, playerId: number) {
  const [player] = await executor
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.id, playerId), isNull(schema.players.deletedAt)));
  return player ?? null;
}

/**
 * Operatører kan ikke endre, deaktivere eller slette operatører og admins. Ellers kunne en
 * operatør f.eks. bytte passordet til en admin og overta kontoen.
 */
const protectedFrom = (actor: { role: Role }, target: { role: Role }) =>
  actor.role !== "admin" && isOperatorRole(target.role);

export async function createPlayer(_prev: PlayerFormState, formData: FormData): Promise<PlayerFormState> {
  const actor = await requireOperator();

  const { values, parsed } = parsePlayerForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { password, role, ...player } = parsed.data;
  // Bare admin kan gi roller. Nye spillere fra en operatør blir vanlige spillere.
  const newRole: Role = actor.role === "admin" ? (role ?? "player") : "player";
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.players).values({
        ...player,
        role: newRole,
        passwordHash: password ? await hashPassword(password) : null,
      });
      await logAction(
        actor,
        "spiller.lagt-til",
        `La til ${fullName(player)}${newRole !== "player" ? ` med rollen ${ROLE_LABELS[newRole]}` : ""}`,
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) return emailTaken(values);
    throw err;
  }

  redirect("/admin?melding=lagt-til");
}

const FIELD_LABELS = {
  firstName: "fornavn",
  lastName: "etternavn",
  email: "e-post",
  phone: "mobil",
  gender: "kjønn",
  level: "nivå",
} as const;

export async function updatePlayer(
  playerId: number,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const actor = await requireOperator();

  const { values, parsed } = parsePlayerForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const before = await loadPlayer(db, playerId);
  if (!before) return { message: "Spilleren finnes ikke lenger.", values };
  if (protectedFrom(actor, before)) {
    return { message: "Bare admin kan endre operatører og admins.", values };
  }

  const { password, role, ...player } = parsed.data;
  // Bare admin kan endre roller; for operatører beholdes rollen spilleren har.
  const newRole: Role = actor.role === "admin" ? (role ?? before.role) : before.role;

  // Hindrer at noen låser seg selv ute.
  if (playerId === actor.id && (!player.active || !isOperatorRole(newRole) || (actor.role === "admin" && newRole !== "admin"))) {
    return {
      message: "Du kan ikke fjerne din egen rolle eller deaktivere deg selv.",
      values,
    };
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      if (before.role === "admin" && newRole !== "admin" && (await isLastAdmin(tx, playerId))) {
        return "siste-admin" as const;
      }

      // Inaktive spillere er ikke med i rankingen.
      if (!player.active) await removeFromRanking(tx, playerId);

      await tx
        .update(schema.players)
        .set({
          ...player,
          role: newRole,
          // Tomt passordfelt betyr at passordet ikke endres.
          ...(password && { passwordHash: await hashPassword(password) }),
        })
        .where(eq(schema.players.id, playerId));

      if (!isOperatorRole(newRole) || !player.active) {
        await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, playerId));
      }

      // Loggen sier hva som ble endret, så feil bruk kan spores.
      const changed: string[] = (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
        .filter((k) => (before[k] ?? null) !== (player[k] ?? null))
        .map((k) => FIELD_LABELS[k]);
      if (password) changed.push("passord");
      if (before.active !== player.active) changed.push(player.active ? "aktivert" : "deaktivert");
      const name = fullName(before);
      if (changed.length > 0) {
        await logAction(actor, "spiller.endret", `Endret ${name}: ${changed.join(", ")}`, tx);
      }
      if (newRole !== before.role) {
        await logAction(
          actor,
          "spiller.rolle",
          `Endret rollen til ${name} fra ${ROLE_LABELS[before.role]} til ${ROLE_LABELS[newRole]}`,
          tx,
        );
      }
      return "lagret" as const;
    });
    if (outcome === "siste-admin") {
      return { message: "Spilleren er den siste admin-en, og kan ikke miste admin-rollen.", values };
    }
  } catch (err) {
    if (isUniqueViolation(err)) return emailTaken(values);
    throw err;
  }

  redirect("/admin?melding=lagret");
}

/**
 * Setter spilleren på pause: inaktiv og ute av rankingen. Ingenting slettes,
 * så kamper og tabeller beholdes, og spilleren kan aktiveres igjen senere.
 */
export async function deactivatePlayer(playerId: number) {
  const actor = await requireOperator();
  if (playerId === actor.id) {
    redirect("/admin?melding=ikke-deg-selv");
  }

  const outcome = await db.transaction(async (tx) => {
    const target = await loadPlayer(tx, playerId);
    if (!target) return "lagret";
    if (protectedFrom(actor, target)) return "kun-admin";
    await removeFromRanking(tx, playerId);
    await tx.update(schema.players).set({ active: false }).where(eq(schema.players.id, playerId));
    // Inaktive spillere kan ikke være innlogget i konsollen.
    await tx.delete(schema.adminSessions).where(eq(schema.adminSessions.playerId, playerId));
    await logAction(actor, "spiller.deaktivert", `Deaktiverte ${fullName(target)}`, tx);
    return "deaktivert";
  });

  redirect(`/admin?melding=${outcome}`);
}

/** Tar spilleren av pause. Plass i rankingen får spilleren ved neste «Oppdater ranking». */
export async function activatePlayer(playerId: number) {
  const actor = await requireOperator();
  await db.transaction(async (tx) => {
    // Slettede spillere kan ikke aktiveres igjen.
    const target = await loadPlayer(tx, playerId);
    if (!target) return;
    await tx.update(schema.players).set({ active: true }).where(eq(schema.players.id, playerId));
    await logAction(actor, "spiller.aktivert", `Aktiverte ${fullName(target)}`, tx);
  });
  redirect("/admin?melding=aktivert");
}

/**
 * Sletter spilleren: alle personopplysninger fjernes, og navnet blir «Tidligere spiller».
 * Raden beholdes så tidligere kamper og resultatlister henger sammen med sine resultater.
 * Påmeldinger, innlogginger og ranking fjernes. Kan ikke angres.
 */
export async function deletePlayer(playerId: number) {
  const actor = await requireOperator();
  if (playerId === actor.id) redirect("/admin?melding=ikke-slette-deg-selv");

  const outcome = await db.transaction(async (tx) => {
    const target = await loadPlayer(tx, playerId);
    if (!target) return "spiller-slettet";
    if (protectedFrom(actor, target)) return "kun-admin";
    if (await isLastAdmin(tx, playerId)) return "siste-admin";
    // En spiller i en runde som pågår, må fjernes fra runden først.
    if (await isInRunningRound(tx, playerId)) return "i-runde";
    await anonymizePlayer(tx, playerId);
    await logAction(actor, "spiller.slettet", `Slettet ${fullName(target)} (anonymisert)`, tx);
    return "spiller-slettet";
  });

  redirect(`/admin?melding=${outcome}`);
}

/**
 * Gir alle aktive spillere en plass i rankingen. Se buildRanking for reglene.
 * Inaktive spillere tas ut av rankingen.
 */
export async function updateRanking() {
  const actor = await requireOperator();

  const newlyRanked = await db.transaction(async (tx) => {
    // Låser spillerradene, så to samtidige oppdateringer ikke gir like plasser.
    const players = await tx
      .select({
        id: schema.players.id,
        ranking: schema.players.ranking,
        level: schema.players.level,
      })
      .from(schema.players)
      .where(eq(schema.players.active, true))
      .for("update");

    const order = buildRanking(players);
    if (order.length > 0) {
      // Én spørring: oppdaterer hver spiller med sin nye plass.
      await tx.execute(sql`
        UPDATE ${schema.players} AS p
        SET ranking = v.ranking
        FROM unnest(${sql.param(order)}::int[]) WITH ORDINALITY AS v(id, ranking)
        WHERE p.id = v.id
      `);
    }
    await tx
      .update(schema.players)
      .set({ ranking: null })
      .where(eq(schema.players.active, false));

    const newlyRanked = players.filter((p) => p.ranking === null).length;
    await logAction(
      actor,
      "ranking.oppdatert",
      `Oppdaterte rankingen (${newlyRanked} ${newlyRanked === 1 ? "spiller" : "spillere"} fikk ny plass)`,
      tx,
    );
    return newlyRanked;
  });

  redirect(`/admin?melding=ranking&nye=${newlyRanked}`);
}
