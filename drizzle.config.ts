import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local (preferred, gitignored) then fall back to .env.
config({ path: ".env.local", override: true });
config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL!,
  },
  verbose: true,
  strict: true,
});
