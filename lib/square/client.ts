import { SquareClient, SquareEnvironment } from "square";

let _client: SquareClient | null = null;

export function getSquareClient(): SquareClient {
  if (_client) return _client;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  // Case-insensitive — Square's own docs use both "production" and
  // "Production" and operators copy verbatim. Defaults to Sandbox if unset
  // or mistyped, which is the safe direction (real money never moves
  // accidentally).
  const env =
    process.env.SQUARE_ENVIRONMENT?.toLowerCase() === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;
  _client = new SquareClient({ token, environment: env });
  return _client;
}
