import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/form";

export const metadata: Metadata = { title: "Kontoen er slettet – Torsdagsligaen" };

export default function AccountDeletedPage() {
  return (
    <AuthCard
      title="Kontoen er slettet"
      intro="Personopplysningene dine er fjernet, og du er logget ut. Takk for kampene!"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vil du bli med igjen senere, kan du{" "}
        <Link href="/registrer" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          registrere deg på nytt
        </Link>
        .
      </p>
    </AuthCard>
  );
}
