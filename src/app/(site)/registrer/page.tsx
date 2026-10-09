import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/form";
import { RedirectIfLoggedIn } from "@/lib/auth/session";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrer deg – Torsdagsligaen" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Bli med i torsdagsligaen"
      intro="Lag en bruker for å melde deg på og følge kampene dine."
    >
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
      <RegisterForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Har du allerede en bruker?{" "}
        <Link href="/logg-inn" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Logg inn
        </Link>
      </p>
    </AuthCard>
  );
}
