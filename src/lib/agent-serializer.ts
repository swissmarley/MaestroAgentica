import type { StoredAgentDefinition, ToolDefinition } from "@/types/agent";

/**
 * Serialize a StoredAgentDefinition to a JSON string.
 * Validates required fields before serialization.
 */
export function serializeDefinition(def: StoredAgentDefinition): string {
  if (!def.systemPrompt) {
    throw new Error("Agent definition must include a systemPrompt");
  }
  if (!def.model) {
    throw new Error("Agent definition must include a model");
  }
  if (def.maxTurns < 1) {
    throw new Error("maxTurns must be at least 1");
  }
  return JSON.stringify(def);
}

/**
 * Deserialize a JSON string into a StoredAgentDefinition.
 * Validates the parsed object has the required shape.
 */
export function deserializeDefinition(json: string): StoredAgentDefinition {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON in agent definition: ${json.slice(0, 100)}...`);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.model !== "string") {
    throw new Error("Agent definition missing required field: model");
  }
  if (typeof obj.systemPrompt !== "string") {
    throw new Error("Agent definition missing required field: systemPrompt");
  }
  if (!Array.isArray(obj.tools)) {
    throw new Error("Agent definition missing required field: tools");
  }
  if (typeof obj.maxTurns !== "number" || obj.maxTurns < 1) {
    throw new Error("Agent definition missing or invalid field: maxTurns");
  }

  return {
    model: obj.model,
    systemPrompt: obj.systemPrompt,
    tools: obj.tools as ToolDefinition[],
    maxTurns: obj.maxTurns,
    temperature: typeof obj.temperature === "number" ? obj.temperature : undefined,
    topP: typeof obj.topP === "number" ? obj.topP : undefined,
    stopSequences: Array.isArray(obj.stopSequences) ? obj.stopSequences as string[] : undefined,
  };
}

/**
 * Create a sensible default agent definition.
 */
export function createDefaultDefinition(): StoredAgentDefinition {
  return {
    model: "claude-sonnet-4-6",
    systemPrompt: "You are a helpful AI assistant.",
    tools: [],
    maxTurns: 10,
  };
}

/**
 * Convert a StoredAgentDefinition to options suitable for the Anthropic SDK
 * messages.create API call.
 */
export function definitionToSdkOptions(def: StoredAgentDefinition): {
  model: string;
  system: string;
  max_tokens: number;
  tools: ToolDefinition[];
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
} {
  const maxTokens = def.model.includes("opus") ? 16384 : 8192;

  const result: {
    model: string;
    system: string;
    max_tokens: number;
    tools: ToolDefinition[];
    temperature?: number;
    top_p?: number;
    stop_sequences?: string[];
  } = {
    model: def.model,
    system: def.systemPrompt,
    max_tokens: maxTokens,
    tools: def.tools,
  };

  if (def.temperature !== undefined) {
    result.temperature = def.temperature;
  }
  if (def.topP !== undefined) {
    result.top_p = def.topP;
  }
  if (def.stopSequences && def.stopSequences.length > 0) {
    result.stop_sequences = def.stopSequences;
  }

  return result;
}
