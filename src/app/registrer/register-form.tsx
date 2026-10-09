"use client";

import { useActionState } from "react";

import { register } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const errors = state?.errors;
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage>{state?.message}</FormMessage>
      <Field
        label="Fullt navn"
        name="name"
        autoComplete="name"
        required
        defaultValue={values?.name}
        errors={errors?.name}
      />
      <Field
        label="E-post"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={values?.email}
        errors={errors?.email}
      />
      <Field
        label="Mobilnummer"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={values?.phone}
        errors={errors?.phone}
        hint="Valgfritt. Brukes hvis noen må nå deg om en kamp."
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
