import { SquareClient, SquareEnvironment } from "square";

let _client: SquareClient | null = null;

export function getSquareClient(): SquareClient {
  if (_client) return _client;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  const env =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;
  _client = new SquareClient({ token, environment: env });
  return _client;
}
