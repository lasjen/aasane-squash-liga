import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Leser .env på samme måte som Next.js gjør.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
