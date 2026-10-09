"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import {
  loginSchema,
  registerSchema,
  type FormState,
  type LoginField,
  type RegisterField,
} from "@/lib/auth/validation";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function isUniqueViolation(err: unknown) {
  const cause = err instanceof Error && "cause" in err ? err.cause : err;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

export async function register(
  _prev: FormState<RegisterField>,
  formData: FormData,
): Promise<FormState<RegisterField>> {
  const values = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
  };
  const parsed = registerSchema.safeParse({
    ...values,
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, email, phone, password } = parsed.data;
  let playerId: number;
  try {
    const [player] = await db
      .insert(schema.players)
      .values({ name, email, phone, passwordHash: await hashPassword(password) })
      .returning({ id: schema.players.id });
    playerId = player.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        errors: { email: ["Denne e-postadressen er allerede registrert. Logg inn i stedet."] },
        values,
      };
    }
    throw err;
  }

  await createSession(playerId);
  redirect("/");
}

export async function login(
  _prev: FormState<LoginField>,
  formData: FormData,
): Promise<FormState<LoginField>> {
  const values = { email: text(formData, "email") };
  const parsed = loginSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, password } = parsed.data;
  const [player] = await db
    .select({
      id: schema.players.id,
      passwordHash: schema.players.passwordHash,
    })
    .from(schema.players)
    .where(eq(schema.players.email, email))
    .limit(1);

  // Samme melding uansett hva som var feil, så skjemaet ikke avslører hvem som er registrert.
  const ok = player?.passwordHash
    ? await verifyPassword(password, player.passwordHash)
    : (await burnPasswordCheck(password), false);
  if (!player || !ok) {
    return { message: "Feil e-post eller passord.", values };
  }

  await createSession(player.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/logg-inn");
}
