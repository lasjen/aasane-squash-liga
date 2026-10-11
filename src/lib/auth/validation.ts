import * as z from "zod";

import { GENDERS, LEVELS } from "@/lib/player-options";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Skriv inn en gyldig e-postadresse." }));

/** Feltene en spiller fyller ut om seg selv, ved registrering og under Innstillinger. */
const profileFields = {
  firstName: z
    .string()
    .trim()
    .min(1, { error: "Skriv inn fornavnet ditt." })
    .max(60, { error: "Fornavnet kan ha maks 60 tegn." }),
  lastName: z
    .string()
    .trim()
    .min(1, { error: "Skriv inn etternavnet ditt." })
    .max(60, { error: "Etternavnet kan ha maks 60 tegn." }),
  gender: z.enum(GENDERS, { error: "Velg kjønn." }),
  level: z.enum(LEVELS, { error: "Velg nivået ditt." }),
  email,
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => v !== "", { error: "Skriv inn mobilnummeret ditt.", abort: true })
    .refine((v) => /^\+?\d{8,15}$/.test(v), {
      error: "Skriv inn et gyldig mobilnummer, f.eks. 412 34 567.",
    }),
};

const newPassword = z
  .string()
  .min(8, { error: "Passordet må ha minst 8 tegn." })
  .max(128, { error: "Passordet kan ha maks 128 tegn." });

const passwordsMatch = (d: { password: string; confirmPassword: string }) =>
  d.password === d.confirmPassword;
const passwordsMismatch = { error: "Passordene er ikke like.", path: ["confirmPassword"] };

export const registerSchema = z
  .object({ ...profileFields, password: newPassword, confirmPassword: z.string() })
  .refine(passwordsMatch, passwordsMismatch);

export const profileSchema = z.object(profileFields);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Skriv inn passordet du har nå." }),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, passwordsMismatch);

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: "Skriv inn passordet ditt for å bekrefte." }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Skriv inn passordet ditt." }),
});

export type FormState<TField extends string> =
  | {
      errors?: Partial<Record<TField, string[]>>;
      message?: string;
      /** Verdier som fylles inn igjen i skjemaet etter en feil (aldri passord). */
      values?: Partial<Record<TField, string>>;
    }
  | undefined;

export type RegisterField =
  | "firstName"
  | "lastName"
  | "gender"
  | "level"
  | "email"
  | "phone"
  | "password"
  | "confirmPassword"
  | "rankedinId";
export type LoginField = "email" | "password";
export type ProfileField = keyof typeof profileFields | "rankedinId";
export type ChangePasswordField = "currentPassword" | "password" | "confirmPassword";
export type DeleteAccountField = "password";
