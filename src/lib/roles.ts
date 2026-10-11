// Roller. Ren logikk uten database, så den kan brukes både på serveren og i skjemaene.

export const ROLES = ["player", "operator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  player: "Spiller",
  operator: "Operatør",
  admin: "Admin",
};

export const ROLE_HINTS: Record<Role, string> = {
  player: "Vanlig spiller uten tilgang til konsollen.",
  operator: "Kan logge inn på /admin og drive ligaen: spillere, runder og resultater.",
  admin: "Som operatør, og kan i tillegg endre roller og se loggen.",
};

/** Operatører og admins har tilgang til konsollen under /admin. Admin er også operatør. */
export const isOperatorRole = (role: Role) => role === "operator" || role === "admin";
