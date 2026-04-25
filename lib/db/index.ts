import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Lazy Drizzle client.
 *
 * Why lazy: Next's `Collecting page data` phase imports every route handler
 * during build, which transitively evaluates this module even when
 * SUPABASE_DB_URL isn't available at build time (e.g. fresh Render
 * deploys where env vars are pasted in only after the first deploy
 * attempt). Eager initialization with `drizzle(undefined, ...)` crashes
 * inside drizzle's options reader.
 *
 * The Proxy below defers initialization until any property is accessed,
 * which only happens at request time when env vars exist.
 */

type DrizzleClient = PostgresJsDatabase<typeof schema>;

let _client: DrizzleClient | null = null;

function instantiate(): DrizzleClient {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set");
  }
  const queryClient = postgres(connectionString, { prepare: false });
  _client = drizzle(queryClient, { schema });
  return _client;
}

export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    const client = _client ?? instantiate();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop as string];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
}) as DrizzleClient;

export type Database = DrizzleClient;
