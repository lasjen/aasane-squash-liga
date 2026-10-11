import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requirePlayer } from "@/lib/auth/session";

import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Innstillinger – Torsdagsligaen" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-10 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Henter profilen din …</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const player = await requirePlayer();
  const [profile] = await db
    .select({
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      gender: schema.players.gender,
      level: schema.players.level,
      email: schema.players.email,
      phone: schema.players.phone,
    })
    .from(schema.players)
    .where(eq(schema.players.id, player.id));

  return (
    <>
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <ProfileForm
          profile={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            gender: profile.gender ?? "",
            level: profile.level ?? "",
            email: profile.email ?? "",
            phone: profile.phone ?? "",
          }}
        />
      </section>
      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xl font-semibold tracking-tight">Bytt passord</h2>
        <PasswordForm />
      </section>
      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xl font-semibold tracking-tight">Slett konto</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Vil du ikke lenger være med i ligaen, kan du slette kontoen og personopplysningene dine.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
