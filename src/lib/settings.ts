import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

/** Kravet om norgesranking for nivå Proff. Av som standard. */
export type ProRequirement = {
  enabled: boolean;
  /** Herrer må være blant de N beste på norgesrankingen. */
  menTop: number;
  /** Damer må være blant de N beste på norgesrankingen. */
  womenTop: number;
};

const PRO_REQUIREMENT_KEY = "proRequirement";
export const DEFAULT_PRO_REQUIREMENT: ProRequirement = { enabled: false, menTop: 50, womenTop: 20 };

export async function getProRequirement(): Promise<ProRequirement> {
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, PRO_REQUIREMENT_KEY));
  return { ...DEFAULT_PRO_REQUIREMENT, ...(row?.value as Partial<ProRequirement> | undefined) };
}

export async function setProRequirement(value: ProRequirement) {
  await db
    .insert(schema.appSettings)
    .values({ key: PRO_REQUIREMENT_KEY, value })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value } });
}
