import type { Metadata } from "next";
import { Suspense } from "react";

import { recheckPros, saveProRequirement } from "@/app/actions/admin-settings";
import { PendingButton } from "@/components/pending-button";
import { requireAdmin } from "@/lib/auth/admin-session";
import { getProRequirement } from "@/lib/settings";

export const metadata: Metadata = { title: "Innstillinger – Admin – Torsdagsligaen" };

type Params = Record<string, string | string[] | undefined>;

const MESSAGES: Record<string, (p: Params) => string> = {
  lagret: () => "Innstillingene er lagret.",
  sjekket: (p) => {
    const checked = Number(p.sjekket) || 0;
    const below = Number(p.utenfor) || 0;
    return checked === 0
      ? "Ingen proff-spillere med RankedIn-valg å sjekke."
      : `${checked} proff-spillere er sjekket. ${
          below === 0 ? "Alle er innenfor grensen." : `${below} er utenfor grensen og er merket i spillerlisten.`
        }`;
  },
  "rankedin-nede": () => "Norgesrankingen kunne ikke hentes fra RankedIn akkurat nå. Prøv igjen senere.",
};

const input =
  "w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 tabular-nums dark:border-zinc-700 dark:bg-zinc-900";

export default function AdminSettingsPage({ searchParams }: PageProps<"/admin/innstillinger">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Innstillinger</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter innstillinger …</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Settings({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const [req, params] = await Promise.all([getProRequirement(), searchParams]);
  const key = typeof params.melding === "string" ? params.melding : undefined;
  const message = key && MESSAGES[key]?.(params);

  return (
    <>
      {message && (
        <p role="status" className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {message}
        </p>
      )}

      <section className="flex max-w-2xl flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Krav for nivå Proff</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Når kravet er på, må spillere som velger nivå Proff velge seg selv fra norgesrankingen
            på RankedIn, og være innenfor grensen under. Admin kan fortsatt sette Proff uten
            RankedIn-valg.
          </p>
        </div>
        <form action={saveProRequirement} className="flex flex-col gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={req.enabled} className="size-4 accent-zinc-900 dark:accent-zinc-100" />
            <span className="font-medium">Krev norgesranking for nivå Proff</span>
          </label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              Herrer: topp
              <input type="number" name="menTop" min={1} max={200} defaultValue={req.menTop} className={input} />
            </label>
            <label className="flex items-center gap-2">
              Damer: topp
              <input type="number" name="womenTop" min={1} max={200} defaultValue={req.womenTop} className={input} />
            </label>
          </div>
          <div>
            <PendingButton
              pendingText="Lagrer …"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Lagre
            </PendingButton>
          </div>
        </form>
        {req.enabled && (
          <form action={recheckPros} className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <PendingButton
              pendingText="Sjekker …"
              className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium disabled:opacity-60 dark:border-zinc-700"
            >
              Sjekk proff-spillere nå
            </PendingButton>
            <span className="text-zinc-500">
              Skjer også når du trykker «Oppdater ranking». De som har falt utenfor, merkes, men
              beholder nivået.
            </span>
          </form>
        )}
      </section>
    </>
  );
}
