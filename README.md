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
| `seasons`          | Sesonger av ligaen, f.eks. «Høst 2026»                         |
| `divisions`        | Divisjoner per sesong, nivå 1 er øverst                        |
| `division_players` | Hvilken divisjon en spiller er i (maks én per sesong)          |
| `rounds`           | Kampkvelder (torsdager) i en sesong                            |
| `matches`          | Kamper mellom to spillere, med status og vinner                |
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

- `src/app/` – sider og layout (App Router)
- `src/db/` – databasetilkobling og datamodell
- `drizzle/` – databasemigrasjoner
- `public/` – statiske filer som bilder og ikoner
