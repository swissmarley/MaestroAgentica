// ─── Pricing (USD per million tokens) ────────────────────────────────────────
// Prices as of early 2026. Update as Anthropic changes pricing.

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-6": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-sonnet-4-5-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-opus-4-6": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "claude-opus-4-5-20250520": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "claude-opus-4-20250514": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
  },
};

/** Fallback pricing for unknown models */
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
};

/**
 * Calculate the cost in USD for a given model and token usage.
 *
 * @param model - The Claude model identifier string
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens consumed
 * @returns Cost in USD as a floating-point number
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return inputCost + outputCost;
}

/**
 * Format a USD cost value as a human-readable string.
 *
 * - Costs < $0.01 show 4 decimal places (e.g. "$0.0042")
 * - Costs >= $0.01 show 2 decimal places (e.g. "$1.23")
 *
 * @param usd - The cost in USD
 * @returns Formatted string like "$0.0042" or "$1.23"
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `$${usd.toFixed(4)}`;
  }
  return `$${usd.toFixed(2)}`;
}

/**
 * Get the pricing details for a specific model.
 * Returns default pricing if the model is not recognized.
 */
export function getModelPricing(model: string): ModelPricing {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return { ...pricing };
}

/**
 * Get pricing for all known models.
 */
export function getAllModelPricing(): Record<string, ModelPricing> {
  return { ...MODEL_PRICING };
}
