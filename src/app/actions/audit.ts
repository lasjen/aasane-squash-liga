"use server";

import { lt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db, schema } from "@/db";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/admin-session";
import { LOG_RETENTION_OPTIONS, monthsLabel } from "@/lib/log-retention";

/**
 * Sletter logglinjer eldre enn `months` måneder. Bare admin. Selve slettingen
 * loggføres etterpå, så det alltid er spor av at loggen er ryddet.
 */
export async function deleteOldLogEntries(formData: FormData) {
  const admin = await requireAdmin();
  const months = Number(formData.get("months"));
  if (!(LOG_RETENTION_OPTIONS as readonly number[]).includes(months)) {
    redirect("/admin/logg?melding=ugyldig-alder");
  }

  const deleted = await db.transaction(async (tx) => {
    const rows = await tx
      .delete(schema.auditLog)
      .where(lt(schema.auditLog.createdAt, sql`now() - make_interval(months => ${months})`))
      .returning({ id: schema.auditLog.id });
    await logAction(
      admin,
      "logg.slettet",
      `Slettet ${rows.length} ${rows.length === 1 ? "logglinje" : "logglinjer"} eldre enn ${monthsLabel(months)}`,
      tx,
    );
    return rows.length;
  });

  redirect(`/admin/logg?melding=slettet&antall=${deleted}`);
}
