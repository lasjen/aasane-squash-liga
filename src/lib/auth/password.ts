import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt er innebygd i Node og anbefalt av OWASP for passordlagring.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 } as const;

function deriveKey(password: string, salt: Buffer, opts: ScryptOptions, keylen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Lager en hash på formen scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = PARAMS;
  const key = await deriveKey(password, salt, { N, r, p }, keylen);
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await deriveKey(
    password,
    Buffer.from(saltB64, "base64"),
    { N: Number(n), r: Number(r), p: Number(p) },
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

// Brukes når e-posten ikke finnes, så svartiden ikke avslører hvem som er registrert.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("ikke-et-ekte-passord");
  await verifyPassword(password, await dummyHash);
}
