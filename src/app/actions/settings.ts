"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { deleteOtherSessions, deleteSession, requirePlayer } from "@/lib/auth/session";
import {
  changePasswordSchema,
  deleteAccountSchema,
  profileSchema,
  type ChangePasswordField,
  type DeleteAccountField,
  type FormState,
  type ProfileField,
  womensLeagueFor,
} from "@/lib/auth/validation";
import { anonymizePlayer, isInRunningRound, isLastAdmin } from "@/lib/players/delete-player";
import { syncWomenRanking } from "@/lib/women-ranking";

/** Som FormState, men med `saved` når lagringen gikk bra. */
export type SettingsState<TField extends string> =
  | (NonNullable<FormState<TField>> & { saved?: boolean })
  | undefined;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function isUniqueViolation(err: unknown) {
  const cause = err instanceof Error && "cause" in err ? err.cause : err;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

export async function updateProfile(
  _prev: SettingsState<ProfileField>,
  formData: FormData,
): Promise<SettingsState<ProfileField>> {
  const player = await requirePlayer();

  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    gender: text(formData, "gender"),
    level: text(formData, "level"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    wantsWomensLeague: text(formData, "wantsWomensLeague"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const profile = {
    ...parsed.data,
    wantsWomensLeague: womensLeagueFor(parsed.data.gender, parsed.data.wantsWomensLeague),
  };
  try {
    await db.transaction(async (tx) => {
      await tx.update(schema.players).set(profile).where(eq(schema.players.id, player.id));
      await syncWomenRanking(tx);
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { errors: { email: ["En annen spiller bruker allerede denne e-postadressen."] }, values };
    }
    throw err;
  }

  // Navnet i headeren skal oppdateres med en gang.
  refresh();
  return { saved: true };
}

export async function changePassword(
  _prev: SettingsState<ChangePasswordField>,
  formData: FormData,
): Promise<SettingsState<ChangePasswordField>> {
  const player = await requirePlayer();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const [row] = await db
    .select({ passwordHash: schema.players.passwordHash })
    .from(schema.players)
    .where(eq(schema.players.id, player.id));
  const ok = row?.passwordHash && (await verifyPassword(parsed.data.currentPassword, row.passwordHash));
  if (!ok) {
    return { errors: { currentPassword: ["Passordet er feil."] } };
  }

  await db
    .update(schema.players)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(schema.players.id, player.id));
  await deleteOtherSessions(player.id);

  refresh();
  return { saved: true };
}

/**
 * Spilleren sletter sin egen konto. Krever passordet, så en glemt innlogget telefon ikke
 * er nok. Personopplysningene fjernes på samme måte som når admin sletter en spiller:
 * tidligere kamper og resultater blir stående som «Tidligere spiller». Kan ikke angres.
 */
export async function deleteAccount(
  _prev: SettingsState<DeleteAccountField>,
  formData: FormData,
): Promise<SettingsState<DeleteAccountField>> {
  const player = await requirePlayer();

  const parsed = deleteAccountSchema.safeParse({ password: text(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const [row] = await db
    .select({ passwordHash: schema.players.passwordHash })
    .from(schema.players)
    .where(eq(schema.players.id, player.id));
  const ok = row?.passwordHash && (await verifyPassword(parsed.data.password, row.passwordHash));
  if (!ok) {
    return { errors: { password: ["Passordet er feil."] } };
  }

  const outcome = await db.transaction(async (tx) => {
    // Låser raden, så sjekkene og slettingen ikke krysser en samtidig endring.
    await tx
      .select({ id: schema.players.id })
      .from(schema.players)
      .where(eq(schema.players.id, player.id))
      .for("update");
    if (await isInRunningRound(tx, player.id)) return "i-runde";
    if (await isLastAdmin(tx, player.id)) return "siste-admin";
    await anonymizePlayer(tx, player.id);
    return "slettet";
  });

  if (outcome === "i-runde") {
    return {
      message:
        "Du er med i kveldens runde. Kontoen kan slettes når runden er ferdig, eller be en admin fjerne deg fra runden.",
    };
  }
  if (outcome === "siste-admin") {
    return {
      message:
        "Du er den eneste admin-en i ligaen. Gi en annen spiller admin-tilgang før du sletter kontoen din.",
    };
  }

  // Øktene er allerede slettet i databasen. Dette fjerner cookien.
  await deleteSession();
  redirect("/konto-slettet");
}
