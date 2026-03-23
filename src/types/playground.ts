export type MessageRole = "user" | "assistant" | "system";

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
}

export interface PlaygroundMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  tokenCount?: number;
  isStreaming?: boolean;
}

export interface TestSession {
  id: string;
  agentId: string;
  versionId: string;
  name: string;
  messages: PlaygroundMessage[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type SSEEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "tool_use_start"
  | "tool_use_delta"
  | "tool_result"
  | "message_stop"
  | "error"
  | "done";

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}
