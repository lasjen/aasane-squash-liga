# aasane-squash-liga

Applikasjon for å administrere torsdagsligaen hos Åsane Squash Klubb.

Bygget med [Next.js](https://nextjs.org) (App Router), TypeScript og Tailwind CSS.

## Kom i gang

Krever Node.js 20 eller nyere og Docker.

```bash
npm install
cp .env.example .env      # databaseoppsett for lokal utvikling
npm run db:up             # starter PostgreSQL i Docker
npm run db:migrate        # oppretter tabellene
npm run db:seed           # legger inn testdata
npm run dev
```

Åpne deretter [http://localhost:3000](http://localhost:3000) i nettleseren.

## Database

PostgreSQL kjører i Docker (`docker-compose.yml`). Vi bruker
[Drizzle ORM](https://orm.drizzle.team) for spørringer og migrasjoner.

- `src/db/schema.ts` – datamodellen, skrevet i TypeScript
- `drizzle/` – SQL-migrasjoner generert fra modellen (sjekkes inn i git)
- `scripts/migrate.mjs` – kjører nye migrasjoner mot `DATABASE_URL`

### Datamodell

| Tabell             | Innhold                                                        |
| ------------------ | -------------------------------------------------------------- |
| `players`          | Spillere i klubben, på tvers av sesonger                       |
| `admin_sessions`   | Innloggingsøkter for admin, adskilt fra vanlige økter          |
| `seasons`          | Sesonger av ligaen, f.eks. «Høst 2026»                         |
| `divisions`        | Divisjoner per sesong, nivå 1 er øverst                        |
| `division_players` | Hvilken divisjon en spiller er i (maks én per sesong)          |
| `rounds`           | Kampkvelder (torsdager) i en sesong, med status                |
| `round_signups`    | Hvem som har meldt seg på en runde                             |
| `cancelled_dates`  | Torsdager uten liga, med valgfri melding til spillerne         |
| `round_groups`     | Gruppene i en startet runde, gruppe 1 øverst                   |
| `round_group_players` | Hvilken gruppe hver spiller er i                            |
| `round_results`    | Resultatliste for avsluttede runder, med ranking før og etter  |
| `round_ranking_snapshots` | Hele rankingen slik den var før runden ble avsluttet    |
| `matches`          | Kamper i en gruppe, med status og vinner                       |
| `match_games`      | Poeng per game i en kamp (best av fem)                         |
| `sessions`         | Innloggingsøkter (lagrer bare en hash av tokenet)              |

Tabellpoeng regnes ut fra kampene i stedet for å lagres, så tabellen
alltid stemmer med resultatene.

### Slik endrer du databasen

1. Endre `src/db/schema.ts`.
2. Kjør `npm run db:generate -- --name kort-beskrivelse`. Det lager en ny
   SQL-fil i `drizzle/`.
3. Les gjennom SQL-filen, spesielt hvis kolonner gis nytt navn eller slettes.
4. Kjør `npm run db:migrate` lokalt og test.
5. Commit både skjemaendringen og SQL-filen i samme commit.

Ved utrulling kjøres `npm run db:migrate` før den nye versjonen av appen
startes. Bare migrasjoner som ikke er kjørt fra før blir kjørt, og
Drizzle holder oversikt i tabellen `drizzle.__drizzle_migrations`.

Ikke rediger en migrasjon som allerede er kjørt i produksjon. Lag en ny i
stedet.

### Testdata

Testdataene ligger i `src/db/seed/`. Akkurat nå er det 20 fiktive spillere
med e-postadresser på `example.com`. Alle har passordet `squash123`, så du
kan logge inn som for eksempel `kari.nordmann@example.com`.
`ola.nordmann@example.com` er admin og kan også logge inn på `/admin/logg-inn`.

| Kommando           | Hva den gjør                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run db:seed`  | Legger til testdata som mangler. Trygt å kjøre flere ganger |
| `npm run db:reset` | Tømmer **alle** tabeller og legger testdataene inn på nytt |

Begge kommandoene nekter å kjøre mot en database som ikke er lokal, og når
`NODE_ENV=production`. Testdata hører bare hjemme i utviklingsdatabasen.

For å starte helt fra bunnen, med tomt skjema og alt:

```bash
docker compose down -v    # sletter databasevolumet
npm run db:up && npm run db:migrate && npm run db:seed
```

## Innlogging

Spillere registrerer seg på `/registrer` og logger inn på `/logg-inn` med
e-post og passord.

- Passord hashes med scrypt (innebygd i Node) og lagres aldri i klartekst.
- Innloggingen er en økt i databasen. Cookien inneholder et tilfeldig
  token, og databasen lagrer bare SHA-256-hashen av det. Utlogging sletter
  økten.
- Øktene varer i 30 dager. Cookien er `httpOnly`, `sameSite=lax` og `secure`
  i produksjon.
- E-post lagres med små bokstaver, så `Ola@x.no` og `ola@x.no` er samme bruker.
- Koden ligger i `src/lib/auth/` og `src/app/actions/auth.ts`. Bruk
  `getCurrentPlayer()` for å hente innlogget spiller, og `requirePlayer()`
  på sider som krever innlogging.

Registreringen lagrer fornavn, etternavn, kjønn, mobil, e-post (brukes som
brukernavn), passord og nivå. Valgene for kjønn og nivå ligger i
`src/lib/player-options.ts`.

### Administratorer

Administratorer er vanlige spillere med `is_admin = true`. De logger inn på
`/admin/logg-inn` med samme e-post og passord som ellers, og havner på `/admin`.

- Admin-innloggingen er en egen økt (`admin_sessions`) med egen cookie,
  `admin_session`, som bare gjelder under `/admin` og varer i 12 timer.
  Å være logget inn som spiller gir ikke admin-tilgang.
- `is_admin` sjekkes ved hver forespørsel. Fjernes flagget, mister personen
  tilgangen med en gang.
- Gi eller fjern admin-tilgang for en registrert spiller:

  ```bash
  npm run admin -- ola@klubben.no
  npm run admin -- ola@klubben.no --fjern
  ```

- På `/admin` kan admin legge til og endre spillere, og oppdatere rankingen.
  «Deaktiver» setter spilleren på pause (inaktiv) og tar den ut av
  rankingen. Spillerne under rykker opp én plass. «Aktiver» tar spilleren av
  pause, og «Oppdater ranking» gir den en ny plass.
- «Slett» fjerner spilleren for godt: navn, e-post, mobil, nivå, passord,
  admin-tilgang, ranking, påmeldinger og innlogginger fjernes. Raden beholdes
  med navnet «Tidligere spiller» (og `deleted_at` satt), så tidligere kamper og
  resultatlister beholder resultatene sine. Spillere i en runde som pågår må
  fjernes fra runden først.
- Bruk `requireAdmin()` fra `src/lib/auth/admin-session.ts` i hver
  admin-side og hver server action for admin. Layouten alene beskytter ikke.

### Påmelding

Innloggede spillere havner på `/pamelding` og melder seg på neste runde der.

- Neste runde er førstkommende torsdag i norsk tid, eller i dag hvis det er
  torsdag. Er den runden startet, blir neste torsdag neste runde.
- Runden lages første gang noen melder seg på. Finnes ingen sesong som dekker
  datoen, lages «Vår ÅÅÅÅ» (januar–juni) eller «Høst ÅÅÅÅ» (juli–desember).
- Spillere kan melde seg av helt til admin starter runden.
- Spillere på pause kan ikke melde seg på.
- Logikken ligger i `src/lib/rounds.ts` og `src/lib/dates.ts`.

### Spillersidene

Spillersidene er egne sider med egen adresse, vist som faner i headeren
(`src/components/player-tabs.tsx`). Nye sider legges til i `TABS` der.

| Fane          | Adresse          | Innhold                                                  |
| ------------- | ---------------- | -------------------------------------------------------- |
| Påmelding     | `/pamelding`     | Meld deg på eller av neste runde                         |
| Liga          | `/liga`          | Runden som er i gang. Vises bare når admin har startet en runde |
| Ranking       | `/ranking`       | Klubbens ranking for aktive spillere                     |
| Resultater    | `/resultater`    | Avsluttede runder med resultatliste og kamper            |
| Regler        | `/regler`        | Ligaens regler. Tallene hentes fra koden                 |
| Innstillinger | `/innstillinger` | Endre egen profil og bytte passord                       |

Passordbytte logger spilleren ut på alle andre enheter.

### Ligarunden (admin)

Fanen «Ligarunde» på `/admin/runde` styrer runden:

- **Før start:** påmeldte (maks 16), venteliste og andre aktive spillere.
  Admin kan legge til spillere og fjerne dem som ikke møter. Neste på
  ventelisten rykker da opp.
- **Start runde** setter opp grupper og kamper. Spillerne sorteres etter
  ranking og deles i grupper på 3 og 4 (`src/lib/groups.ts`): 4 → [4],
  6 → [3, 3], 7 → [3, 4], 16 → [4, 4, 4, 4]. 5 spillere blir én gruppe på 5.
- **Kamper** (`src/lib/match-plan.ts`): i grupper på 3 spiller alle mot alle
  (1–2, 2–3, 1–3). I grupper på 4 spiller 1 mot 4 og 2 mot 3, deretter
  vinner mot vinner og taper mot taper. I gruppen på 5 fordeles spillerne
  etter slangeprinsippet i pulje A (1, 4, 5) og pulje B (2, 3). A spiller alle
  mot alle og B én kamp. Så spiller nr. 1 i A mot vinner av B om 1. plass, og
  nr. 2 i A mot taper av B om 3. plass. Nr. 3 i A blir nr. 5.
- **Edit** lar admin flytte, fjerne og legge til spillere i gruppene.
  Kampene i berørte grupper settes opp på nytt.
- **Restart runde** setter opp grupper og kamper på nytt fra påmeldingene.
- **Avlys denne torsdagen** (før start) sletter runden og påmeldingene, og
  påmeldingen går videre til neste torsdag med liga. Admin kan skrive en
  melding til spillerne. Under «Torsdager uten liga» kan admin legge inn
  framtidige datoer uten liga, endre meldingen og fjerne avlysninger. En
  avlysning kan skjules for spillerne («Ikke vis for spillerne»); datoen
  hoppes likevel over. På påmeldingssiden vises
  avlyste torsdager før neste runde som en notis med meldingen, og senere
  avlysninger i en egen liste.
- **Avslutt runde** lager resultatlisten, oppdaterer rankingen og åpner
  påmeldingen til neste runde. Knappen er sperret til alle kampene har resultat.

### Resultatliste og ranking

Når runden avsluttes (`src/lib/standings.ts` og `src/lib/round-results.ts`):

1. **Plass i gruppen.** Grupper på 4: vinner og taper av vinnerkampen (kamp 3),
   så vinner og taper av taperkampen (kamp 4). Grupper på 3: flest seire, så
   settdifferanse, vunne sett, innbyrdes oppgjør og ranking før runden.
2. **Resultatliste.** Gruppene settes etter hverandre, men vinneren av hver
   gruppe bytter plass med sistemann i gruppen over: G1 [a1, a2, a3, a4] og
   G2 [b1, b2, b3] gir a1, a2, a3, b1, a4, b2, b3.
3. **Ranking.** Spillere som ikke var med, rykker 2 plasser ned. Plassene som
   blir igjen, fordeles på deltakerne i resultatlistens rekkefølge.

Avsluttede runder vises under fanen «Resultater» for både spillere
(`/resultater`) og admin (`/admin/resultater`).

**Rette resultater etterpå.** På admin-siden for en avsluttet runde kan admin
registrere og rette resultater. Resultatlisten og rankingen regnes da ut på
nytt fra rankingen før runden (`round_ranking_snapshots`), så utregningen gir
samme svar uansett hvor mange ganger den gjøres. Det går bare for den sist
avsluttede runden, og ikke mens en annen runde er i gang. Runder som ble
avsluttet før rankingen ble lagret, bruker dagens ranking som utgangspunkt.

Mens en runde er i gang, havner spillerne på `/liga` etter innlogging og ser
gruppen og kampene sine der.

### Resultater

Admin velger kampformat per runde under Ligarunde: best av 3 sett (standard)
eller best av 5. Resultatet er antall vunne sett, f.eks. 2–1 (`src/lib/score.ts`).
Formatet låses når første resultat er registrert.

- Spilleren registrerer resultat for egne kamper under «Dine kamper» på
  `/liga`. Resultatet venter da på at motspilleren bekrefter.
- Motspilleren kan bekrefte eller rette. Retter motspilleren, må den første
  spilleren bekrefte. Et bekreftet resultat kan bare endres av admin.
- Admin ser alle kampene på `/admin/runde` og kan registrere eller endre
  resultater. Det admin registrerer er bekreftet med en gang.
- I grupper på 4 fylles vinner og taper fra kamp 1 og 2 inn i kamp 3 og 4 så
  snart resultatet er registrert. Endres et resultat slik at en senere kamp får
  andre spillere, nullstilles resultatet i den kampen
  (`src/lib/match-results.ts`).
- Restart og endringer i gruppene under Edit setter opp kampene på nytt, og
  registrerte resultater i de berørte gruppene slettes.

### Ranking

`players.ranking` er spillerens plass i klubben, der 1 er best. Knappen
«Oppdater ranking» på `/admin` (`buildRanking` i `src/lib/ranking.ts`):

1. Spillere som allerede har ranking beholder rekkefølgen sin, og hull tettes.
2. Aktive spillere uten ranking legges under, sortert på nivå: proff,
   erfaren, medium, nybegynner, og til slutt de uten nivå. Innen hvert nivå
   er rekkefølgen tilfeldig.
3. Inaktive spillere tas ut av rankingen.

Første gang, når ingen har ranking, blir hele rankingen altså laget ut fra nivå.

Prosjektet bruker Cache Components, så komponenter som leser innloggingen
må ligge inni `<Suspense>`.

## Nyttige kommandoer

| Kommando        | Hva den gjør                         |
| --------------- | ------------------------------------ |
| `npm run dev`   | Starter utviklingsserveren           |
| `npm run build` | Bygger appen for produksjon          |
| `npm run start` | Kjører den bygde appen               |
| `npm run lint`  | Sjekker koden med ESLint             |

## Struktur

- `src/app/(site)/` – sidene spillerne bruker
- `src/app/admin/` – admin-sidene, med egen header
- `src/db/` – databasetilkobling og datamodell
- `drizzle/` – databasemigrasjoner
- `public/` – statiske filer som bilder og ikoner
