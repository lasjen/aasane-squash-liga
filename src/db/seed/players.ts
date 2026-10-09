import type { players } from "../schema";

type NewPlayer = typeof players.$inferInsert;

/** Fiktive testspillere. E-postadressene bruker example.com, som aldri leverer e-post. */
export const testPlayers: NewPlayer[] = [
  { name: "Ola Nordmann", email: "ola.nordmann@example.com", phone: "40000001" },
  { name: "Kari Nordmann", email: "kari.nordmann@example.com", phone: "40000002" },
  { name: "Lars Hansen", email: "lars.hansen@example.com", phone: "40000003" },
  { name: "Ingrid Johansen", email: "ingrid.johansen@example.com", phone: "40000004" },
  { name: "Erik Olsen", email: "erik.olsen@example.com", phone: "40000005" },
  { name: "Marte Larsen", email: "marte.larsen@example.com", phone: "40000006" },
  { name: "Henrik Andersen", email: "henrik.andersen@example.com", phone: "40000007" },
  { name: "Sofie Pedersen", email: "sofie.pedersen@example.com", phone: "40000008" },
  { name: "Magnus Nilsen", email: "magnus.nilsen@example.com", phone: "40000009" },
  { name: "Nora Kristiansen", email: "nora.kristiansen@example.com", phone: "40000010" },
  { name: "Jonas Jensen", email: "jonas.jensen@example.com", phone: "40000011" },
  { name: "Emma Karlsen", email: "emma.karlsen@example.com", phone: "40000012" },
  { name: "Sindre Johnsen", email: "sindre.johnsen@example.com", phone: "40000013" },
  { name: "Thea Pettersen", email: "thea.pettersen@example.com", phone: "40000014" },
  { name: "Andreas Eriksen", email: "andreas.eriksen@example.com", phone: "40000015" },
  { name: "Hanna Berg", email: "hanna.berg@example.com", phone: "40000016" },
  { name: "Martin Haugen", email: "martin.haugen@example.com", phone: "40000017" },
  { name: "Ida Hagen", email: "ida.hagen@example.com", phone: "40000018" },
  { name: "Kristian Bakken", email: "kristian.bakken@example.com", phone: "40000019" },
  { name: "Silje Lie", email: "silje.lie@example.com", phone: "40000020", active: false },
];
