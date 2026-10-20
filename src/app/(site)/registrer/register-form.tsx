"use client";

import { useActionState } from "react";

import { register } from "@/app/actions/auth";
import { Field, FormMessage, RadioGroup, SubmitButton } from "@/components/form";
import { WomensLeagueCheckbox } from "@/components/womens-league-checkbox";
import { GENDER_LABELS, GENDERS, LEVEL_HINTS, LEVEL_LABELS, LEVELS } from "@/lib/player-options";

const genderOptions = GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }));
const levelOptions = LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l], hint: LEVEL_HINTS[l] }));

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const errors = state?.errors;
  const values = state?.values;

  return (
    // key nullstiller radioknappene når skjemaet kommer tilbake med feil,
    // så defaultChecked gjelder verdiene fra forrige innsending.
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage>{state?.message}</FormMessage>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Fornavn"
          name="firstName"
          autoComplete="given-name"
          required
          defaultValue={values?.firstName}
          errors={errors?.firstName}
        />
        <Field
          label="Etternavn"
          name="lastName"
          autoComplete="family-name"
          required
          defaultValue={values?.lastName}
          errors={errors?.lastName}
        />
      </div>
      <RadioGroup
        legend="Kjønn"
        name="gender"
        options={genderOptions}
        defaultValue={values?.gender}
        errors={errors?.gender}
      />
      <WomensLeagueCheckbox
        initialGender={values?.gender}
        defaultChecked={values?.wantsWomensLeague === "on"}
      />
      <Field
        label="Mobilnummer"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        defaultValue={values?.phone}
        errors={errors?.phone}
        hint="Brukes hvis noen må nå deg om en kamp."
      />
      <Field
        label="E-post"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={values?.email}
        errors={errors?.email}
        hint="Dette blir brukernavnet ditt."
      />
      <RadioGroup
        legend="Nivå"
        name="level"
        layout="column"
        options={levelOptions}
        defaultValue={values?.level}
        errors={errors?.level}
      />
      <Field
        label="Passord"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        errors={errors?.password}
        hint="Minst 8 tegn."
      />
      <Field
        label="Gjenta passord"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <SubmitButton pending={pending}>Registrer meg</SubmitButton>
    </form>
  );
}
