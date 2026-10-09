"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db, schema } from "@/db";
import { createAdminSession, deleteAdminSession } from "@/lib/auth/admin-session";
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
  const [admin] = await db
    .select({ id: schema.admins.id, passwordHash: schema.admins.passwordHash })
    .from(schema.admins)
    .where(eq(schema.admins.email, email))
    .limit(1);

  // Samme melding uansett hva som var feil, så skjemaet ikke avslører hvem som er admin.
  const ok = admin
    ? await verifyPassword(password, admin.passwordHash)
    : (await burnPasswordCheck(password), false);
  if (!admin || !ok) {
    return { message: "Feil e-post eller passord.", values };
  }

  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  await deleteAdminSession();
  redirect("/admin/logg-inn");
}
