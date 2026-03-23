import Anthropic from "@anthropic-ai/sdk";
import type { StoredAgentDefinition } from "@/types/agent";
import type { SSEEventType } from "@/types/playground";
import { definitionToSdkOptions } from "@/lib/agent-serializer";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecuteAgentOptions {
  definition: StoredAgentDefinition;
  prompt: string;
  apiKey: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  onMetric?: (metric: ExecutionMetrics) => void;
  onLog?: (level: string, message: string, meta?: Record<string, unknown>) => void;
}

export interface ExecutionMetrics {
  inputTokens: number;
  outputTokens: number;
  responseTime: number;
  model: string;
  turns: number;
  success: boolean;
}

interface SSEPayload {
  type: SSEEventType;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function encodeSSE(event: SSEPayload): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ─── Main Executor ───────────────────────────────────────────────────────────

/**
 * Execute an agent with the given options and return a ReadableStream of
 * SSE-formatted events. The stream can be directly used as a Response body
 * for Next.js API routes.
 *
 * Uses the Anthropic SDK messages.create API with streaming. Supports
 * multi-turn tool use loops up to definition.maxTurns.
 */
export function executeAgent(options: ExecuteAgentOptions): ReadableStream {
  const { definition, prompt, apiKey, conversationHistory, onMetric, onLog } = options;

  const sdkOptions = definitionToSdkOptions(definition);
  const maxTurns = definition.maxTurns;

  const client = new Anthropic({ apiKey });

  const log = (level: string, message: string, meta?: Record<string, unknown>) => {
    onLog?.(level, message, meta);
  };

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const startTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let turnCount = 0;

      const messages: Array<{
        role: "user" | "assistant";
        content: string | Array<Record<string, unknown>>;
      }> = [];

      if (conversationHistory) {
        for (const msg of conversationHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      messages.push({ role: "user", content: prompt });

      try {
        log("info", "Starting agent execution", {
          model: sdkOptions.model,
          maxTurns,
          toolCount: sdkOptions.tools.length,
        });

        controller.enqueue(
          encoder.encode(
            encodeSSE({
              type: "message_start",
              messageId: crypto.randomUUID(),
              model: sdkOptions.model,
            })
          )
        );

        let continueLoop = true;

        while (continueLoop && turnCount < maxTurns) {
          turnCount++;
          log("debug", `Turn ${turnCount}/${maxTurns}`);

          const turnStart = Date.now();

          const streamParams: Record<string, unknown> = {
            model: sdkOptions.model,
            max_tokens: sdkOptions.max_tokens,
            system: sdkOptions.system,
            messages,
            stream: true,
          };

          if (sdkOptions.tools.length > 0) {
            streamParams.tools = sdkOptions.tools;
          }
          if (sdkOptions.temperature !== undefined) {
            streamParams.temperature = sdkOptions.temperature;
          }
          if (sdkOptions.top_p !== undefined) {
            streamParams.top_p = sdkOptions.top_p;
          }
          if (sdkOptions.stop_sequences) {
            streamParams.stop_sequences = sdkOptions.stop_sequences;
          }

          const stream = await client.messages.create(
            streamParams as unknown as Parameters<typeof client.messages.create>[0]
          );

          let currentText = "";
          const toolUseBlocks: Array<{
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];
          let currentToolId = "";
          let currentToolName = "";
          let currentToolInputJson = "";
          let stopReason = "";
          let turnInputTokens = 0;
          let turnOutputTokens = 0;
          let blockIndex = 0;

          for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
            const eventType = event.type as string;

            switch (eventType) {
              case "message_start": {
                const message = event.message as Record<string, unknown>;
                const usage = message.usage as { input_tokens: number } | undefined;
                if (usage) {
                  turnInputTokens = usage.input_tokens;
                }
                break;
              }

              case "content_block_start": {
                const contentBlock = event.content_block as Record<string, unknown>;
                blockIndex = event.index as number;

                if (contentBlock.type === "text") {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: "content_block_start",
                        index: blockIndex,
                        contentBlock: { type: "text", text: "" },
                      })
                    )
                  );
                } else if (contentBlock.type === "tool_use") {
                  currentToolId = contentBlock.id as string;
                  currentToolName = contentBlock.name as string;
                  currentToolInputJson = "";
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: "tool_use_start",
                        index: blockIndex,
                        toolUseId: currentToolId,
                        toolName: currentToolName,
                      })
                    )
                  );
                }
                break;
              }

              case "content_block_delta": {
                const delta = event.delta as Record<string, unknown>;

                if (delta.type === "text_delta") {
                  const text = delta.text as string;
                  currentText += text;
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: "content_block_delta",
                        index: blockIndex,
                        delta: { type: "text_delta", text },
                      })
                    )
                  );
                } else if (delta.type === "input_json_delta") {
                  const partialJson = delta.partial_json as string;
                  currentToolInputJson += partialJson;
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: "tool_use_delta",
                        index: blockIndex,
                        delta: { type: "input_json_delta", partial_json: partialJson },
                      })
                    )
                  );
                }
                break;
              }

              case "content_block_stop": {
                if (currentToolId && currentToolInputJson) {
                  let parsedInput: Record<string, unknown> = {};
                  try {
                    parsedInput = JSON.parse(currentToolInputJson);
                  } catch {
                    log("warn", `Failed to parse tool input JSON for ${currentToolName}`);
                  }

                  toolUseBlocks.push({
                    type: "tool_use",
                    id: currentToolId,
                    name: currentToolName,
                    input: parsedInput,
                  });

                  currentToolId = "";
                  currentToolName = "";
                  currentToolInputJson = "";
                }

                controller.enqueue(
                  encoder.encode(
                    encodeSSE({
                      type: "content_block_stop",
                      index: blockIndex,
                    })
                  )
                );
                break;
              }

              case "message_delta": {
                const delta = event.delta as Record<string, unknown>;
                const usage = event.usage as { output_tokens: number } | undefined;
                stopReason = (delta.stop_reason as string) ?? "";
                if (usage) {
                  turnOutputTokens = usage.output_tokens;
                }
                break;
              }
            }
          }

          totalInputTokens += turnInputTokens;
          totalOutputTokens += turnOutputTokens;

          const turnDuration = Date.now() - turnStart;
          log("debug", `Turn ${turnCount} completed in ${turnDuration}ms`, {
            inputTokens: turnInputTokens,
            outputTokens: turnOutputTokens,
            stopReason,
          });

          if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
            // Build the assistant message with text + tool_use blocks
            const assistantContent: Array<Record<string, unknown>> = [];
            if (currentText) {
              assistantContent.push({ type: "text", text: currentText });
            }
            for (const tool of toolUseBlocks) {
              assistantContent.push(tool);
            }
            messages.push({ role: "assistant", content: assistantContent });

            // In the playground, tool results are simulated. A real deployment
            // would route these to actual tool execution.
            const toolResults: Array<Record<string, unknown>> = toolUseBlocks.map(
              (tool) => {
                const result = {
                  type: "tool_result",
                  tool_use_id: tool.id,
                  content: JSON.stringify({
                    status: "success",
                    message: `Tool ${tool.name} executed (simulated). Wire up real tool execution in the deployment runtime.`,
                  }),
                };

                controller.enqueue(
                  encoder.encode(
                    encodeSSE({
                      type: "tool_result",
                      toolUseId: tool.id,
                      output: result.content,
                      isError: false,
                    })
                  )
                );

                return result;
              }
            );

            messages.push({ role: "user", content: toolResults });
            currentText = "";
          } else {
            continueLoop = false;
          }
        }

        const totalDuration = Date.now() - startTime;

        const metrics: ExecutionMetrics = {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          responseTime: totalDuration,
          model: sdkOptions.model,
          turns: turnCount,
          success: true,
        };

        onMetric?.(metrics);

        controller.enqueue(
          encoder.encode(
            encodeSSE({
              type: "done",
              totalInputTokens,
              totalOutputTokens,
              totalDuration,
              turns: turnCount,
            })
          )
        );

        log("info", "Agent execution completed", {
          turns: turnCount,
          totalInputTokens,
          totalOutputTokens,
          totalDuration,
        });
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        log("error", `Agent execution failed: ${errMessage}`);

        const metrics: ExecutionMetrics = {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          responseTime: Date.now() - startTime,
          model: sdkOptions.model,
          turns: turnCount,
          success: false,
        };

        onMetric?.(metrics);

        controller.enqueue(
          encoder.encode(
            encodeSSE({
              type: "error",
              message: errMessage,
              code:
                error instanceof Anthropic.APIError
                  ? String(error.status)
                  : "INTERNAL",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });
}
