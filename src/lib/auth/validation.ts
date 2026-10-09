import * as z from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Skriv inn en gyldig e-postadresse." }));

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: "Navnet må ha minst 2 tegn." })
      .max(100, { error: "Navnet kan ha maks 100 tegn." }),
    email,
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => v === "" || /^\+?\d{8,15}$/.test(v), {
        error: "Skriv inn et gyldig telefonnummer, f.eks. 412 34 567.",
      })
      .transform((v) => v || null),
    password: z
      .string()
      .min(8, { error: "Passordet må ha minst 8 tegn." })
      .max(128, { error: "Passordet kan ha maks 128 tegn." }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Passordene er ikke like.",
    path: ["confirmPassword"],
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

export type RegisterField = "name" | "email" | "phone" | "password" | "confirmPassword";
export type LoginField = "email" | "password";
