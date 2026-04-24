import Anthropic from "@anthropic-ai/sdk";

/**
 * Singleton Anthropic client. The SDK is stateless, so reusing a single
 * instance just avoids re-parsing the API key + constructing the fetch
 * agent on every extraction call.
 */

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const EXTRACTION_MODEL = "claude-sonnet-4-6";
