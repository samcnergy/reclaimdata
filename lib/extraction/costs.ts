/**
 * Per-million-token prices for the extraction model, in USD cents
 * (i.e. US$3/M → 300 cents/M). Update when Anthropic changes pricing.
 *
 * Cache reads are ~10% of input cost; cache writes are ~125% (5-min TTL).
 * We round to the nearest cent at the record level.
 */

type PricingEntry = {
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
  cacheReadCentsPerMillion: number;
  cacheWriteCentsPerMillion: number;
};

const PRICING: Record<string, PricingEntry> = {
  "claude-sonnet-4-6": {
    inputCentsPerMillion: 300, // $3/M
    outputCentsPerMillion: 1500, // $15/M
    cacheReadCentsPerMillion: 30, // ~0.1x input
    cacheWriteCentsPerMillion: 375, // ~1.25x input
  },
  "claude-opus-4-7": {
    inputCentsPerMillion: 500,
    outputCentsPerMillion: 2500,
    cacheReadCentsPerMillion: 50,
    cacheWriteCentsPerMillion: 625,
  },
};

export function estimateCostCents(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): number {
  const rate = PRICING[args.model];
  if (!rate) {
    // Fall back to Sonnet 4.6 pricing — never free.
    return estimateCostCents({ ...args, model: "claude-sonnet-4-6" });
  }
  const totalCents =
    (args.inputTokens * rate.inputCentsPerMillion) / 1_000_000 +
    (args.outputTokens * rate.outputCentsPerMillion) / 1_000_000 +
    ((args.cacheReadTokens ?? 0) * rate.cacheReadCentsPerMillion) / 1_000_000 +
    ((args.cacheCreationTokens ?? 0) * rate.cacheWriteCentsPerMillion) / 1_000_000;
  return Math.round(totalCents);
}
