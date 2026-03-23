import { create } from "zustand";
import type { PlaygroundMessage, ToolCallInfo } from "@/types/playground";

interface PlaygroundState {
  messages: PlaygroundMessage[];
  isStreaming: boolean;
  currentSessionId: string | null;
  toolCalls: ToolCallInfo[];
  error: string | null;
}

interface PlaygroundActions {
  sendMessage: (agentId: string, versionId: string, prompt: string) => Promise<void>;
  addMessage: (message: PlaygroundMessage) => void;
  clearChat: () => void;
  saveSession: (agentId: string) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
}

type PlaygroundStore = PlaygroundState & PlaygroundActions;

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentSessionId: null,
  toolCalls: [],
  error: null,

  sendMessage: async (agentId: string, versionId: string, prompt: string) => {
    const userMessage: PlaygroundMessage = {
      id: generateId(),
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };

    const assistantMessageId = generateId();
    const assistantMessage: PlaygroundMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null,
      toolCalls: [],
    }));

    try {
      const res = await fetch(`/api/agents/${agentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, versionId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("No response body received");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7).trim();
            // We handle event type via the data parsing below
            void eventType;
            continue;
          }

          if (!line.startsWith("data: ")) continue;

          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          let event: { event: string; data: Record<string, unknown> };
          try {
            event = JSON.parse(dataStr);
          } catch {
            continue;
          }

          switch (event.event) {
            case "content_block_delta": {
              const delta = event.data?.delta as string | undefined;
              if (delta) {
                accumulatedContent += delta;
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent }
                      : m
                  ),
                }));
              }
              break;
            }

            case "tool_use_start": {
              const toolCall: ToolCallInfo = {
                id: (event.data?.id as string) ?? generateId(),
                name: (event.data?.name as string) ?? "unknown",
                input: (event.data?.input as Record<string, unknown>) ?? {},
                status: "running",
                startedAt: Date.now(),
              };
              set((state) => ({
                toolCalls: [...state.toolCalls, toolCall],
              }));
              break;
            }

            case "tool_result": {
              const toolId = event.data?.tool_use_id as string;
              const output = event.data?.output as string;
              const isError = event.data?.is_error as boolean;
              set((state) => ({
                toolCalls: state.toolCalls.map((tc) =>
                  tc.id === toolId
                    ? {
                        ...tc,
                        output,
                        status: isError ? ("error" as const) : ("completed" as const),
                        completedAt: Date.now(),
                      }
                    : tc
                ),
              }));
              break;
            }

            case "message_stop": {
              const tokenCount = event.data?.usage as
                | { output_tokens?: number }
                | undefined;
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        isStreaming: false,
                        toolCalls: state.toolCalls.length > 0 ? state.toolCalls : undefined,
                        tokenCount: tokenCount?.output_tokens,
                      }
                    : m
                ),
              }));
              break;
            }

            case "error": {
              const errorMsg = (event.data?.message as string) ?? "An error occurred";
              set({ error: errorMsg });
              break;
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      set((state) => ({
        error: message,
        messages: state.messages.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: m.content || "Error: " + message, isStreaming: false }
            : m
        ),
      }));
    } finally {
      set({ isStreaming: false });
    }
  },

  addMessage: (message: PlaygroundMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  clearChat: () => {
    set({
      messages: [],
      toolCalls: [],
      currentSessionId: null,
      error: null,
    });
  },

  saveSession: async (agentId: string) => {
    const { messages, currentSessionId } = get();
    try {
      const res = await fetch(`/api/agents/${agentId}/test`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save session");
      }
      const session = await res.json();
      set({ currentSessionId: session.id });
      return session.id as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save session";
      set({ error: message });
      throw err;
    }
  },

  loadSession: async (sessionId: string) => {
    try {
      const res = await fetch(`/api/agents/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error("Failed to load session");
      }
      const session = await res.json();
      set({
        messages: session.messages,
        currentSessionId: session.id,
        toolCalls: [],
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session";
      set({ error: message });
      throw err;
    }
  },
}));
