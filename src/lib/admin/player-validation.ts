import * as z from "zod";

import { GENDERS, LEVELS } from "@/lib/player-options";
import { ROLES } from "@/lib/roles";

/**
 * Tomt felt blir null, ellers valideres verdien med schemaet.
 * `error` trengs for enum-felter, der unionen ellers gir en generell engelsk feilmelding.
 */
const optional = <T extends z.ZodType<unknown, string>>(schema: T, error?: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.union([z.null(), schema], error ? { error } : undefined));

/**
 * Spillerskjemaet admin bruker for å legge til og endre spillere.
 * Bare navn er obligatorisk, så admin kan legge inn spillere som ikke skal logge inn selv.
 */
export const adminPlayerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: "Skriv inn fornavn." })
    .max(60, { error: "Fornavnet kan ha maks 60 tegn." }),
  lastName: z
    .string()
    .trim()
    .min(1, { error: "Skriv inn etternavn." })
    .max(60, { error: "Etternavnet kan ha maks 60 tegn." }),
  gender: optional(z.enum(GENDERS), "Velg et gyldig kjønn."),
  level: optional(z.enum(LEVELS), "Velg et gyldig nivå."),
  email: optional(
    z.string().toLowerCase().pipe(z.email({ error: "Skriv inn en gyldig e-postadresse." })),
  ),
  phone: optional(
    z
      .string()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => /^\+?\d{8,15}$/.test(v), {
        error: "Skriv inn et gyldig mobilnummer, f.eks. 412 34 567.",
      }),
  ),
  /** Tomt betyr «ikke endre» når spilleren finnes, og «ingen innlogging» for nye spillere. */
  password: optional(
    z
      .string()
      .min(8, { error: "Passordet må ha minst 8 tegn." })
      .max(128, { error: "Passordet kan ha maks 128 tegn." }),
  ),
  active: z.boolean(),
  /** Bare med når en admin lagrer skjemaet. Mangler den, endres ikke rollen. */
  role: z.enum(ROLES, { error: "Velg en gyldig rolle." }).optional(),
});

export type AdminPlayerField = keyof z.input<typeof adminPlayerSchema>;
