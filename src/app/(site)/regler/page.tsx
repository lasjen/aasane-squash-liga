import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MAX_PLAYERS, MIN_LEAGUE_PLAYERS, MIN_PLAYERS } from "@/lib/groups";
import { MIN_WOMENS_LEAGUE_PLAYERS, WOMENS_LEAGUE_CHECKBOX_LABEL } from "@/lib/leagues";
import { LEVEL_LABELS, LEVELS } from "@/lib/player-options";
import { DEFAULT_BEST_OF, setsToWin } from "@/lib/score";

export const metadata: Metadata = { title: "Regler – Torsdagsligaen" };

// Tallene hentes fra de samme konstantene som appen bruker, så reglene her
// holder seg i takt med hvordan ligaen faktisk fungerer.
const levelsBestFirst = [...LEVELS]
  .reverse()
  .map((l) => LEVEL_LABELS[l].toLowerCase())
  .join(", ");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

const list = "ml-5 flex list-disc flex-col gap-1";

export default function RulesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Regler</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Slik fungerer torsdagsligaen i Åsane Squash Klubb.
        </p>
      </header>

      <Section title="Påmelding">
        <ul className={list}>
          <li>
            Hver torsdag er en egen runde. Du melder deg på under «Påmelding». Torsdager uten
            liga, for eksempel i ferier, står også der.
          </li>
          <li>
            Det er plass til {MAX_PLAYERS} spillere. De som melder seg på etter det, står på
            venteliste i den rekkefølgen de meldte seg på.
          </li>
          <li>
            Du kan melde deg av helt til runden starter. Da rykker neste på ventelisten opp.
          </li>
          <li>
            Ved oppmøte kan admin legge til spillere og fjerne dem som ikke møter, før runden
            startes.
          </li>
        </ul>
      </Section>

      <Section title="Grupper">
        <ul className={list}>
          <li>
            Når runden starter, deles spillerne inn i grupper etter ranking. Gruppe 1 har de
            best rangerte.
          </li>
          <li>
            Gruppene har 3 eller 4 spillere, og de største gruppene ligger øverst. For eksempel
            gir 6 spillere to grupper på 3, 7 spillere en gruppe på 4 og en på 3, og 16 spillere
            fire grupper på 4.
          </li>
          <li>
            Med 5 spillere blir det én gruppe på 5 (se under). Det trengs minst {MIN_PLAYERS}{" "}
            spillere for å starte en runde.
          </li>
        </ul>
      </Section>

      <Section title="Dameliga">
        <ul className={list}>
          <li>
            Kvinner kan krysse av for «{WOMENS_LEAGUE_CHECKBOX_LABEL}» under Innstillinger.
          </li>
          <li>
            Er minst {MIN_WOMENS_LEAGUE_PLAYERS} av de påmeldte kvinnene med i dameligaen, spiller de i
            egne damegrupper, satt opp etter dameligaens ranking. Resten spiller i «Alle» som vanlig.
            Med dameliga holder det med {MIN_LEAGUE_PLAYERS} spillere i hver liga.
          </li>
          <li>
            Blir det færre enn {MIN_LEAGUE_PLAYERS} igjen i «Alle», spiller alle sammen i «Alle» den
            runden.
          </li>
          <li>
            Dameligaen har sin egen ranking, som oppdateres etter samme regler som «Alle». Kvinnene er
            fortsatt med i «Alle»-rankingen, og så lenge de spiller dameliga, beholder de plassen sin
            der i stedet for å rykke ned.
          </li>
        </ul>
      </Section>

      <Section title="Kamper">
        <p>
          Kampene spilles best av {DEFAULT_BEST_OF} sett ({setsToWin(DEFAULT_BEST_OF)} vunne sett
          for å vinne), med mindre admin har valgt best av 5 for runden.
        </p>
        <ul className={list}>
          <li>
            <span className="font-medium">Gruppe på 3:</span> alle mot alle, i rekkefølgen 1–2,
            2–3 og 1–3.
          </li>
          <li>
            <span className="font-medium">Gruppe på 4:</span> 1 mot 4 og 2 mot 3. Deretter spiller
            vinnerne om 1. plass og taperne om 3. plass.
          </li>
          <li>
            <span className="font-medium">Gruppe på 5:</span> spillerne deles i pulje A (nr. 1, 4
            og 5) og pulje B (nr. 2 og 3). Pulje A spiller alle mot alle, pulje B én kamp. Så
            spiller nr. 1 i pulje A mot vinneren i pulje B om 1. plass, og nr. 2 i pulje A mot
            taperen i pulje B om 3. plass. Nr. 3 i pulje A blir nr. 5.
          </li>
        </ul>
      </Section>

      <Section title="Resultater">
        <ul className={list}>
          <li>Du registrerer resultatet for egne kamper under «Liga», som antall vunne sett.</li>
          <li>
            Motspilleren bekrefter resultatet, eller retter det. Retter motspilleren, må du
            bekrefte det nye resultatet.
          </li>
          <li>
            Et bekreftet resultat kan bare endres av admin. Admin kan også registrere resultater
            selv.
          </li>
          <li>Runden avsluttes når alle kampene har resultat.</li>
        </ul>
      </Section>

      <Section title="Plassering i gruppen">
        <ul className={list}>
          <li>
            I grupper på 4 og 5 avgjør kampene om 1. og 3. plass rekkefølgen, som beskrevet over.
          </li>
          <li>
            I grupper på 3 (og pulje A i gruppen på 5) teller først antall seire, så
            settdifferanse, så antall vunne sett, så innbyrdes oppgjør, og til slutt ranking før
            runden.
          </li>
        </ul>
      </Section>

      <Section title="Opp- og nedrykk">
        <p>
          Etter runden settes gruppene sammen til én resultatliste. Vinneren av hver gruppe
          rykker opp forbi sistemann i gruppen over. Eksempel med to grupper: 1., 2. og 3. i
          gruppe 1, så vinneren av gruppe 2, så nr. 4 i gruppe 1, og deretter resten av gruppe 2.
        </p>
      </Section>

      <Section title="Ranking">
        <ul className={list}>
          <li>
            Rankingen oppdateres når runden avsluttes. Spillerne som var med, bytter plass etter
            resultatlisten.
          </li>
          <li>Spillere som ikke var med i runden, rykker 2 plasser ned.</li>
          <li>
            Nye spillere får plass nederst i rankingen, sortert etter nivået de oppga
            ({levelsBestFirst}).
          </li>
          <li>Spillere som står på pause, er ikke med i rankingen.</li>
        </ul>
      </Section>
    </main>
  );
}
