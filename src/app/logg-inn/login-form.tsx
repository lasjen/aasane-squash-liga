"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage>{state?.message}</FormMessage>
      <Field
        label="E-post"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
      />
      <Field
        label="Passord"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state?.errors?.password}
      />
      <SubmitButton pending={pending}>Logg inn</SubmitButton>
    </form>
  );
}
