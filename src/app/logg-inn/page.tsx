import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/form";
import { RedirectIfLoggedIn } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logg inn – Torsdagsligaen" };

export default function LoginPage() {
  return (
    <AuthCard title="Logg inn" intro="Bruk e-posten og passordet du registrerte deg med.">
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
      <LoginForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Ny i ligaen?{" "}
        <Link href="/registrer" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Registrer deg
        </Link>
      </p>
    </AuthCard>
  );
}
