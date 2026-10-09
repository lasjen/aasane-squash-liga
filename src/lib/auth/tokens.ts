import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const SESSION_DAYS = 30;

/** Et nytt tilfeldig økt-token og utløpstidspunktet for økten. */
export function newSessionToken() {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  };
}

/** Databasen lagrer bare hashen, så en lekket database ikke kan brukes til å kapre økter. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
