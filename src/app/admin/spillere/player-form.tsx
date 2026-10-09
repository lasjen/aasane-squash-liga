"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Checkbox, Field, FormMessage, RadioGroup, SubmitButton } from "@/components/form";
import type { AdminPlayerField } from "@/lib/admin/player-validation";
import type { FormState } from "@/lib/auth/validation";
import { GENDER_LABELS, GENDERS, LEVEL_LABELS, LEVELS } from "@/lib/player-options";

type PlayerFormState = FormState<AdminPlayerField>;

const notSet = { value: "", label: "Ikke oppgitt" };
const genderOptions = [...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] })), notSet];
const levelOptions = [...LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] })), notSet];

export type PlayerFormDefaults = Partial<Record<AdminPlayerField, string>>;

export function PlayerForm({
  action,
  defaults,
  submitLabel,
  isNew,
}: {
  action: (prev: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  /** Verdiene skjemaet starter med. Avkrysningsbokser bruker "on" for avkrysset. */
  defaults: PlayerFormDefaults;
  submitLabel: string;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.errors;
  // Etter en feil vises det som ble sendt inn, ellers startverdiene.
  const values = state?.values ?? defaults;

  return (
    <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage>{state?.message}</FormMessage>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Fornavn"
          name="firstName"
          required
          defaultValue={values.firstName}
          errors={errors?.firstName}
        />
        <Field
          label="Etternavn"
          name="lastName"
          required
          defaultValue={values.lastName}
          errors={errors?.lastName}
        />
      </div>
      <RadioGroup
        legend="Kjønn"
        name="gender"
        options={genderOptions}
        defaultValue={values.gender ?? ""}
        errors={errors?.gender}
        required={false}
      />
      <Field
        label="Mobilnummer"
        name="phone"
        type="tel"
        defaultValue={values.phone}
        errors={errors?.phone}
      />
      <Field
        label="E-post"
        name="email"
        type="email"
        defaultValue={values.email}
        errors={errors?.email}
        hint="Brukernavnet spilleren logger inn med."
      />
      <RadioGroup
        legend="Nivå"
        name="level"
        options={levelOptions}
        defaultValue={values.level ?? ""}
        errors={errors?.level}
        required={false}
      />
      <Field
        label={isNew ? "Passord" : "Nytt passord"}
        name="password"
        type="password"
        autoComplete="new-password"
        errors={errors?.password}
        hint={
          isNew
            ? "Valgfritt. Uten passord kan ikke spilleren logge inn før det er satt."
            : "La stå tomt for å beholde passordet spilleren har."
        }
      />
      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <Checkbox
          label="Aktiv"
          name="active"
          defaultChecked={values.active === "on"}
          hint="Inaktive spillere er ikke med i rankingen."
        />
        <Checkbox
          label="Admin"
          name="isAdmin"
          defaultChecked={values.isAdmin === "on"}
          hint="Kan logge inn på /admin/logg-inn."
        />
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        <Link href="/admin" className="text-sm font-medium underline">
          Avbryt
        </Link>
      </div>
    </form>
  );
}
