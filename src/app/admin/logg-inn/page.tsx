import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/form";
import { RedirectIfOperator } from "@/lib/auth/admin-session";

import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Konsoll – logg inn – Torsdagsligaen" };

export default function AdminLoginPage() {
  return (
    <AuthCard title="Logg inn i konsollen" intro="For operatører og admins som driver ligaen.">
      <Suspense fallback={null}>
        <RedirectIfOperator />
      </Suspense>
      <AdminLoginForm />
    </AuthCard>
  );
}
