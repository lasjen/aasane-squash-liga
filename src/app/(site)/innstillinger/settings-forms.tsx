"use client";

import { useActionState } from "react";

import { changePassword, updateProfile } from "@/app/actions/settings";
import { Field, FormSuccess, RadioGroup, SubmitButton } from "@/components/form";
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
