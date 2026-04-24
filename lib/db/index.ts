import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  console.warn(
    "[db] SUPABASE_DB_URL not set — Drizzle client will fail on first query.",
  );
}

const queryClient = connectionString
  ? postgres(connectionString, { prepare: false })
  : (undefined as unknown as ReturnType<typeof postgres>);

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
