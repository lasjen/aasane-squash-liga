import type { players } from "../schema";

type NewPlayer = typeof players.$inferInsert;

/** Felles passord for alle testspillerne. Kun for lokal utvikling. */
export const TEST_PASSWORD = "squash123";

/** Fiktive testspillere. E-postadressene bruker example.com, som aldri leverer e-post. */
export const testPlayers: NewPlayer[] = [
  { firstName: "Ola", lastName: "Nordmann", gender: "male", level: "beginner", email: "ola.nordmann@example.com", phone: "40000001", isAdmin: true },
  { firstName: "Kari", lastName: "Nordmann", gender: "female", level: "intermediate", email: "kari.nordmann@example.com", phone: "40000002" },
  { firstName: "Lars", lastName: "Hansen", gender: "male", level: "experienced", email: "lars.hansen@example.com", phone: "40000003" },
  { firstName: "Ingrid", lastName: "Johansen", gender: "female", level: "pro", email: "ingrid.johansen@example.com", phone: "40000004" },
  { firstName: "Erik", lastName: "Olsen", gender: "male", level: "beginner", email: "erik.olsen@example.com", phone: "40000005" },
  { firstName: "Marte", lastName: "Larsen", gender: "female", level: "intermediate", email: "marte.larsen@example.com", phone: "40000006" },
  { firstName: "Henrik", lastName: "Andersen", gender: "male", level: "experienced", email: "henrik.andersen@example.com", phone: "40000007" },
  { firstName: "Sofie", lastName: "Pedersen", gender: "female", level: "pro", email: "sofie.pedersen@example.com", phone: "40000008" },
  { firstName: "Magnus", lastName: "Nilsen", gender: "male", level: "beginner", email: "magnus.nilsen@example.com", phone: "40000009" },
  { firstName: "Nora", lastName: "Kristiansen", gender: "female", level: "intermediate", email: "nora.kristiansen@example.com", phone: "40000010" },
  { firstName: "Jonas", lastName: "Jensen", gender: "male", level: "experienced", email: "jonas.jensen@example.com", phone: "40000011" },
  { firstName: "Emma", lastName: "Karlsen", gender: "female", level: "pro", email: "emma.karlsen@example.com", phone: "40000012" },
  { firstName: "Sindre", lastName: "Johnsen", gender: "male", level: "beginner", email: "sindre.johnsen@example.com", phone: "40000013" },
  { firstName: "Thea", lastName: "Pettersen", gender: "female", level: "intermediate", email: "thea.pettersen@example.com", phone: "40000014" },
  { firstName: "Andreas", lastName: "Eriksen", gender: "male", level: "experienced", email: "andreas.eriksen@example.com", phone: "40000015" },
  { firstName: "Hanna", lastName: "Berg", gender: "female", level: "pro", email: "hanna.berg@example.com", phone: "40000016" },
  { firstName: "Martin", lastName: "Haugen", gender: "male", level: "beginner", email: "martin.haugen@example.com", phone: "40000017" },
  { firstName: "Ida", lastName: "Hagen", gender: "female", level: "intermediate", email: "ida.hagen@example.com", phone: "40000018" },
  { firstName: "Kristian", lastName: "Bakken", gender: "male", level: "experienced", email: "kristian.bakken@example.com", phone: "40000019" },
  { firstName: "Silje", lastName: "Lie", gender: "female", level: "pro", email: "silje.lie@example.com", phone: "40000020", active: false },
];
