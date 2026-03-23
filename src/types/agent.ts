export type AgentStatus = "draft" | "active" | "paused" | "archived";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface McpServer {
  name: string;
  url: string;
  apiKey?: string;
  enabled: boolean;
}

export interface AgentSkill {
  name: string;
  content: string;
  enabled: boolean;
}

export interface StoredAgentDefinition {
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxTurns: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  webSearchEnabled?: boolean;
  mcpServers?: McpServer[];
  skills?: AgentSkill[];
}

export interface AgentVersion {
  id: string;
  agentId: string;
  version: string;
  definition: StoredAgentDefinition;
  changelog: string;
  parentId: string | null;
  tag: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  icon: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  versions?: AgentVersion[];
  latestVersion?: AgentVersion;
}

export interface CreateAgentInput {
  name: string;
  description: string;
  definition: StoredAgentDefinition;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  status?: AgentStatus;
  tags?: string[];
}

export interface CreateVersionInput {
  definition: StoredAgentDefinition;
  changelog: string;
}

export interface AgentMetrics {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  totalTokens: number;
  totalCost: number;
  avgTurns: number;
  requestsByHour: { hour: string; count: number }[];
}

export interface LogEntry {
  id: string;
  agentId: string;
  deploymentId: string | null;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
