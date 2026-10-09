import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/form";
import { RedirectIfAdmin } from "@/lib/auth/admin-session";

import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin – logg inn – Torsdagsligaen" };

export default function AdminLoginPage() {
  return (
    <AuthCard title="Logg inn som admin" intro="Bare for styret og ligaansvarlige.">
      <Suspense fallback={null}>
        <RedirectIfAdmin />
      </Suspense>
      <AdminLoginForm />
    </AuthCard>
  );
}
