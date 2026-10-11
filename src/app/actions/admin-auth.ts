"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { logAction } from "@/lib/audit";
import { createAdminSession, deleteAdminSession, getCurrentOperator } from "@/lib/auth/admin-session";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { loginSchema, type FormState, type LoginField } from "@/lib/auth/validation";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function adminLogin(
  _prev: FormState<LoginField>,
  formData: FormData,
): Promise<FormState<LoginField>> {
  const values = { email: text(formData, "email") };
  const parsed = loginSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, password } = parsed.data;
  // Bare aktive operatører og admins kan logge inn her.
  const [admin] = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      passwordHash: schema.players.passwordHash,
    })
    .from(schema.players)
    .where(
      and(
        eq(schema.players.email, email),
        inArray(schema.players.role, ["operator", "admin"]),
        eq(schema.players.active, true),
      ),
    )
    .limit(1);

  // Samme melding uansett hva som var feil, så skjemaet ikke avslører hvem som er admin.
  const ok = admin?.passwordHash
    ? await verifyPassword(password, admin.passwordHash)
    : (await burnPasswordCheck(password), false);
  if (!admin || !ok) {
    return { message: "Feil e-post eller passord.", values };
  }

  await createAdminSession(admin.id);
  await logAction(admin, "innlogging", "Logget inn i konsollen");
  redirect("/admin");
}

export async function adminLogout() {
  const actor = await getCurrentOperator();
  if (actor) await logAction(actor, "utlogging", "Logget ut av konsollen");
  await deleteAdminSession();
  redirect("/admin/logg-inn");
}
