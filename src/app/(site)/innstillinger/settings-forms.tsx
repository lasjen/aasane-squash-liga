"use client";

import { useActionState, useState } from "react";

import { changePassword, deleteAccount, updateProfile } from "@/app/actions/settings";
import { Field, FormMessage, FormSuccess, RadioGroup, SubmitButton } from "@/components/form";
import type { ProfileField } from "@/lib/auth/validation";
import { GENDER_LABELS, GENDERS, LEVEL_HINTS, LEVEL_LABELS, LEVELS } from "@/lib/player-options";

const genderOptions = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));
const levelOptions = LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l], hint: LEVEL_HINTS[l] }));

export function ProfileForm({ profile }: { profile: Record<ProfileField, string> }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const errors = state?.errors;
  // Etter en feil vises det som ble sendt inn, ellers det som er lagret.
  const values = state?.values ?? profile;

  return (
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4" noValidate>
      <FormSuccess>{state?.saved && "Endringene er lagret."}</FormSuccess>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Fornavn"
          name="firstName"
          autoComplete="given-name"
          required
          defaultValue={values.firstName}
          errors={errors?.firstName}
        />
        <Field
          label="Etternavn"
          name="lastName"
          autoComplete="family-name"
          required
          defaultValue={values.lastName}
          errors={errors?.lastName}
        />
      </div>
      <RadioGroup
        legend="Kjønn"
        name="gender"
        options={genderOptions}
        defaultValue={values.gender}
        errors={errors?.gender}
      />
      <Field
        label="Mobilnummer"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        defaultValue={values.phone}
        errors={errors?.phone}
      />
      <Field
        label="E-post"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={values.email}
        errors={errors?.email}
        hint="Dette er brukernavnet ditt."
      />
      <RadioGroup
        legend="Nivå"
        name="level"
        layout="column"
        options={levelOptions}
        defaultValue={values.level}
        errors={errors?.level}
      />
      <SubmitButton pending={pending}>Lagre endringer</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const errors = state?.errors;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormSuccess>
        {state?.saved && "Passordet er byttet. Du er logget ut på andre enheter."}
      </FormSuccess>
      <Field
        label="Nåværende passord"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.currentPassword}
      />
      <Field
        label="Nytt passord"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        errors={errors?.password}
        hint="Minst 8 tegn."
      />
      <Field
        label="Gjenta nytt passord"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <SubmitButton pending={pending}>Bytt passord</SubmitButton>
    </form>
  );
}

/**
 * Sletting av egen konto. Skjemaet vises først etter et ekstra trykk, og krever passordet,
 * så ingen sletter kontoen ved et uhell.
 */
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const errors = state?.errors;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-red-300 px-4 py-2.5 font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Slett kontoen min
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
      noValidate
    >
      <p className="text-sm">
        Navn, e-post, mobilnummer og passord slettes, og du tas ut av rankingen og
        påmeldinger. Tidligere kamper og resultater blir stående, men vises som
        «Tidligere spiller». <strong>Dette kan ikke angres.</strong>
      </p>
      <FormMessage>{state?.message}</FormMessage>
      <Field
        label="Skriv inn passordet ditt for å bekrefte"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.password}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-700 px-4 py-2.5 font-medium text-white transition hover:bg-red-800 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
        >
          {pending ? "Sletter …" : "Slett kontoen for godt"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="font-medium underline">
          Avbryt
        </button>
      </div>
    </form>
  );
}
