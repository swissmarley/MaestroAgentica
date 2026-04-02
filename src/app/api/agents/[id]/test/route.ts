import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiKey } from "@/lib/get-api-key";
import Anthropic from "@anthropic-ai/sdk";
import type { StoredAgentDefinition } from "@/types/agent";
import { executeTool, getToolDefinitionsForIds } from "@/lib/tool-executor";
import type { ToolExecutionContext } from "@/lib/tool-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rough cost estimates per model (per 1M tokens)
const COST_PER_M_INPUT: Record<string, number> = {
  "claude-sonnet-4-6": 3,
  "claude-sonnet-4-20250514": 3,
  "claude-sonnet-4-5-20241022": 3,
  "claude-opus-4-6": 15,
  "claude-opus-4-20250514": 15,
  "claude-opus-4-5-20250520": 15,
  "claude-haiku-4-5-20251001": 0.8,
  "claude-haiku-3-20250307": 0.25,
};
const COST_PER_M_OUTPUT: Record<string, number> = {
  "claude-sonnet-4-6": 15,
  "claude-sonnet-4-20250514": 15,
  "claude-sonnet-4-5-20241022": 15,
  "claude-opus-4-6": 75,
  "claude-opus-4-20250514": 75,
  "claude-opus-4-5-20250520": 75,
  "claude-haiku-4-5-20251001": 4,
  "claude-haiku-3-20250307": 1.25,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { prompt, versionId, history } = body as {
      prompt?: string;
      versionId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Go to Settings to add your Anthropic API key." },
        { status: 500 }
      );
    }

    // Fetch agent with versions, tools, skills, and memory
    const agent = await db.agent.findUnique({
      where: { id: id },
      include: {
        versions: versionId
          ? { where: { id: versionId } }
          : { orderBy: { createdAt: "desc" }, take: 1 },
        tools: true,
        skills: true,
        memories: {
          include: { collection: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const version = agent.versions[0];
    if (!version) {
      return NextResponse.json(
        { error: "No version found for this agent" },
        { status: 404 }
      );
    }

    const definition = JSON.parse(version.definition) as StoredAgentDefinition;

    // ── Build system prompt with skills and memory context ──────────────

    let systemPrompt = definition.systemPrompt || "";

    // Inject skills content
    if (definition.skills?.length) {
      const enabledSkills = definition.skills.filter((s) => s.enabled);
      if (enabledSkills.length > 0) {
        systemPrompt += "\n\n## Agent Skills\n";
        for (const skill of enabledSkills) {
          systemPrompt += `\n### ${skill.name}\n${skill.content}\n`;
        }
      }
    }

    // Inject memory collections context
    if (agent.memories.length > 0) {
      systemPrompt += "\n\n## Available Memory Collections\n";
      systemPrompt += "You have access to the following memory collections via the memory_query, memory_store, and memory_list_collections tools:\n";
      for (const mem of agent.memories) {
        systemPrompt += `- **${mem.collection.name}** (ID: ${mem.collectionId}): ${mem.collection.description || "No description"}\n`;
      }
      systemPrompt += "\nUse memory_query to search for relevant information when the user asks about topics covered by these collections.\n";
    }

    // ── Load tool connections for MCP execution ────────────────────────

    let toolExecContext: ToolExecutionContext | undefined;
    try {
      const settingsRow = await db.settings.findUnique({ where: { key: "tool_connections" } });
      if (settingsRow?.value) {
        const connections = JSON.parse(settingsRow.value);
        const connectorMap = getDefaultConnectorMap();
        toolExecContext = { connections, connectors: connectorMap };
      }
    } catch {
      // If loading fails, continue without MCP context — tools will show helpful errors
    }

    // Tell the agent about its tools
    const attachedToolIds = agent.tools.map((t) => t.toolId);
    if (attachedToolIds.length > 0 || definition.mcpServers?.length) {
      systemPrompt += "\n\n## Available Tools\n";
      systemPrompt += "You have access to tools that allow you to interact with filesystems, memory, and other services. Use them when appropriate to fulfill user requests.\n";
    }

    // ── Build tools list ────────────────────────────────────────────────

    const tools: Anthropic.Tool[] = [];

    // Add custom tools from definition
    if (definition.tools && definition.tools.length > 0) {
      tools.push(
        ...definition.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        } as Anthropic.Tool))
      );
    }

    // Add built-in tools based on attached tool IDs (from DB)
    const builtinToolIds = [...attachedToolIds];

    // Also check mcpServers in definition for tool IDs
    if (definition.mcpServers?.length) {
      for (const mcp of definition.mcpServers) {
        const toolId = mcp.name.toLowerCase().replace(/\s+/g, "-");
        if (!builtinToolIds.includes(toolId) && mcp.enabled !== false) {
          builtinToolIds.push(toolId);
        }
      }
    }

    // Get built-in executable tool definitions for attached tools
    const builtinDefs = getToolDefinitionsForIds(builtinToolIds);
    for (const def of builtinDefs) {
      // Avoid duplicates
      if (!tools.some((t) => t.name === def.name)) {
        tools.push({
          name: def.name,
          description: def.description,
          input_schema: def.input_schema as Anthropic.Tool.InputSchema,
        } as Anthropic.Tool);
      }
    }

    // ── Stream ──────────────────────────────────────────────────────────

    const client = new Anthropic({ apiKey });
    const encoder = new TextEncoder();
    const startTime = Date.now();

    const sendSSE = (event: string, data: Record<string, unknown>): string => {
      return `data: ${JSON.stringify({ event, data })}\n\n`;
    };

    const stream = new ReadableStream({
      async start(controller) {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let success = true;
        let turnCount = 0;

        try {
          controller.enqueue(
            encoder.encode(sendSSE("message_start", { model: definition.model }))
          );

          // Emit active skills so the frontend can show indicators
          const enabledSkills = definition.skills?.filter((s) => s.enabled) || [];
          if (enabledSkills.length > 0) {
            controller.enqueue(
              encoder.encode(
                sendSSE("skills_active", {
                  skills: enabledSkills.map((s) => ({ name: s.name })),
                })
              )
            );
          }

          // Build messages with conversation history for multi-turn context
          const messages: Anthropic.MessageParam[] = [];
          if (history && Array.isArray(history)) {
            for (const msg of history) {
              if (msg.role === "user" || msg.role === "assistant") {
                messages.push({ role: msg.role, content: msg.content });
              }
            }
          }
          messages.push({ role: "user", content: prompt.trim() });

          // Ensure at least 2 turns so tools can execute and the agent
          // can produce a final response based on tool results.
          const maxTurns = Math.max(definition.maxTurns || 10, 2);

          while (turnCount < maxTurns) {
            turnCount++;

            const streamParams: Anthropic.MessageCreateParams = {
              model: definition.model,
              max_tokens: 4096,
              system: systemPrompt,
              messages,
              stream: true,
            };

            if (definition.temperature !== undefined) {
              streamParams.temperature = definition.temperature;
            }
            if (definition.topP !== undefined) {
              streamParams.top_p = definition.topP;
            }
            if (definition.stopSequences && definition.stopSequences.length > 0) {
              streamParams.stop_sequences = definition.stopSequences;
            }

            // Build the full tools list for the API call
            const allApiTools: unknown[] = [...tools];
            if (definition.webSearchEnabled) {
              allApiTools.push({ type: "web_search_20250305", name: "web_search", max_uses: 5 });
            }
            if (allApiTools.length > 0) {
              (streamParams as unknown as Record<string, unknown>).tools = allApiTools;
            }

            const apiStream = await client.messages.stream(streamParams);

            let hasToolUse = false;
            const toolUseBlocks: Array<{
              id: string;
              name: string;
              input: Record<string, unknown>;
            }> = [];
            let currentToolId = "";
            let currentToolName = "";
            let currentToolInputJson = "";
            let assistantContent: Anthropic.ContentBlock[] = [];
            const serverToolIds = new Set<string>();

            for await (const event of apiStream) {
              switch (event.type) {
                case "content_block_start": {
                  const block = event.content_block;
                  if (block.type === "text") {
                    controller.enqueue(
                      encoder.encode(
                        sendSSE("content_block_start", { type: "text", index: event.index })
                      )
                    );
                  } else if (block.type === "tool_use") {
                    currentToolId = block.id;
                    currentToolName = block.name;
                    currentToolInputJson = "";
                    const isServerTool = block.name === "web_search" || block.name.startsWith("web_search_");
                    if (isServerTool) {
                      serverToolIds.add(block.id);
                    } else {
                      hasToolUse = true;
                    }
                    controller.enqueue(
                      encoder.encode(
                        sendSSE("tool_use_start", {
                          id: block.id,
                          name: block.name,
                          input: {},
                        })
                      )
                    );
                  } else if ((block as unknown as Record<string, unknown>).type === "server_tool_use") {
                    const serverBlock = block as unknown as Record<string, unknown>;
                    const blockId = (serverBlock.id as string) || `server_${event.index}`;
                    serverToolIds.add(blockId);
                    currentToolId = blockId;
                    controller.enqueue(
                      encoder.encode(
                        sendSSE("tool_use_start", {
                          id: blockId,
                          name: (serverBlock.name as string) || "web_search",
                          input: {},
                          server_managed: true,
                        })
                      )
                    );
                  }
                  break;
                }
                case "content_block_delta": {
                  const delta = event.delta;
                  if (delta.type === "text_delta") {
                    controller.enqueue(
                      encoder.encode(
                        sendSSE("content_block_delta", { delta: delta.text })
                      )
                    );
                  } else if (delta.type === "input_json_delta") {
                    currentToolInputJson += delta.partial_json;
                    controller.enqueue(
                      encoder.encode(
                        sendSSE("tool_use_delta", {
                          id: currentToolId,
                          delta: delta.partial_json,
                        })
                      )
                    );
                  }
                  break;
                }
                case "content_block_stop": {
                  // If this was a tool_use block, capture it
                  if (currentToolId && !serverToolIds.has(currentToolId)) {
                    let parsedInput: Record<string, unknown> = {};
                    if (currentToolInputJson) {
                      try {
                        parsedInput = JSON.parse(currentToolInputJson);
                      } catch {
                        // bad JSON — use empty input
                      }
                    }
                    toolUseBlocks.push({
                      id: currentToolId,
                      name: currentToolName,
                      input: parsedInput,
                    });
                  }
                  currentToolId = "";
                  currentToolName = "";
                  currentToolInputJson = "";
                  controller.enqueue(
                    encoder.encode(
                      sendSSE("content_block_stop", { index: event.index })
                    )
                  );
                  break;
                }
                case "message_delta": {
                  break;
                }
              }
            }

            const finalMessage = await apiStream.finalMessage();
            assistantContent = finalMessage.content;

            totalInputTokens += finalMessage.usage?.input_tokens || 0;
            totalOutputTokens += finalMessage.usage?.output_tokens || 0;

            // ── Execute tools for real ──────────────────────────────────
            if (hasToolUse && toolUseBlocks.length > 0) {
              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const block of toolUseBlocks) {
                // Execute the tool for real (local or MCP)
                const result = await executeTool(block.name, block.input, toolExecContext);

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: result.output,
                  is_error: result.isError,
                });

                controller.enqueue(
                  encoder.encode(
                    sendSSE("tool_result", {
                      tool_use_id: block.id,
                      output: result.output,
                      is_error: result.isError,
                    })
                  )
                );
              }

              messages.push({ role: "assistant", content: assistantContent });
              messages.push({ role: "user", content: toolResults });
            } else {
              break;
            }
          }

          // Send message_stop with real usage
          controller.enqueue(
            encoder.encode(
              sendSSE("message_stop", {
                usage: {
                  input_tokens: totalInputTokens,
                  output_tokens: totalOutputTokens,
                },
              })
            )
          );

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          success = false;
          const message = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(sendSSE("error", { message }))
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }

        // Record metrics asynchronously
        const responseTime = Date.now() - startTime;
        const costIn = (totalInputTokens / 1_000_000) * (COST_PER_M_INPUT[definition.model] || 3);
        const costOut = (totalOutputTokens / 1_000_000) * (COST_PER_M_OUTPUT[definition.model] || 15);

        db.performanceMetric.create({
          data: {
            agentId: id,
            responseTime,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalCostUsd: costIn + costOut,
            success,
            modelUsed: definition.model,
            numTurns: turnCount,
            metadata: JSON.stringify({ source: "playground" }),
          },
        }).catch((err) => {
          console.error("Failed to record metric:", err);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error(`POST /api/agents/${id}/test error:`, err);
    return NextResponse.json(
      { error: "Failed to start test" },
      { status: 500 }
    );
  }
}

// ── Default connector map (MCP endpoints by connector ID) ──────────────

function getDefaultConnectorMap(): Record<string, { id: string; mcpEndpoint: string }> {
  const connectors: Array<{ id: string; mcpEndpoint: string }> = [
    { id: "github", mcpEndpoint: "https://api.githubcopilot.com/mcp/" },
    { id: "slack", mcpEndpoint: "npx -y @modelcontextprotocol/server-slack" },
    { id: "filesystem", mcpEndpoint: "npx -y @modelcontextprotocol/server-filesystem" },
    { id: "postgres", mcpEndpoint: "npx -y @modelcontextprotocol/server-postgres" },
    { id: "brave-search", mcpEndpoint: "npx -y @modelcontextprotocol/server-brave-search" },
    { id: "google-drive", mcpEndpoint: "npx -y @modelcontextprotocol/server-gdrive" },
    { id: "memory", mcpEndpoint: "npx -y @modelcontextprotocol/server-memory" },
    { id: "puppeteer", mcpEndpoint: "npx -y @modelcontextprotocol/server-puppeteer" },
    { id: "notion", mcpEndpoint: "npx -y @modelcontextprotocol/server-notion" },
    { id: "discord", mcpEndpoint: "npx -y @modelcontextprotocol/server-discord" },
    { id: "telegram", mcpEndpoint: "npx -y @modelcontextprotocol/server-telegram" },
    { id: "outlook", mcpEndpoint: "npx -y @modelcontextprotocol/server-outlook" },
    { id: "gmail", mcpEndpoint: "npx -y @modelcontextprotocol/server-gmail" },
    { id: "google-calendar", mcpEndpoint: "npx -y @modelcontextprotocol/server-google-calendar" },
    { id: "onedrive", mcpEndpoint: "npx -y @modelcontextprotocol/server-onedrive" },
    { id: "context7", mcpEndpoint: "npx -y @upstash/context7-mcp" },
    { id: "wikipedia", mcpEndpoint: "npx -y @modelcontextprotocol/server-wikipedia" },
    { id: "stripe", mcpEndpoint: "npx -y @modelcontextprotocol/server-stripe" },
    { id: "cloudflare", mcpEndpoint: "npx -y @modelcontextprotocol/server-cloudflare" },
    { id: "airtable", mcpEndpoint: "npx -y @modelcontextprotocol/server-airtable" },
    { id: "hubspot", mcpEndpoint: "npx -y @modelcontextprotocol/server-hubspot" },
    { id: "salesforce", mcpEndpoint: "npx -y @modelcontextprotocol/server-salesforce" },
    { id: "supabase", mcpEndpoint: "npx -y @modelcontextprotocol/server-supabase" },
    { id: "mongodb", mcpEndpoint: "npx -y @modelcontextprotocol/server-mongodb" },
    { id: "mysql", mcpEndpoint: "npx -y @modelcontextprotocol/server-mysql" },
    { id: "figma", mcpEndpoint: "npx -y @modelcontextprotocol/server-figma" },
    { id: "zapier", mcpEndpoint: "npx -y @modelcontextprotocol/server-zapier" },
    { id: "canva", mcpEndpoint: "npx -y @modelcontextprotocol/server-canva" },
    { id: "paypal", mcpEndpoint: "npx -y @modelcontextprotocol/server-paypal" },
    { id: "asana", mcpEndpoint: "npx -y @modelcontextprotocol/server-asana" },
    { id: "jira", mcpEndpoint: "npx -y @modelcontextprotocol/server-jira" },
    { id: "confluence", mcpEndpoint: "npx -y @modelcontextprotocol/server-confluence" },
    { id: "n8n", mcpEndpoint: "npx -y @modelcontextprotocol/server-n8n" },
  ];

  const map: Record<string, { id: string; mcpEndpoint: string }> = {};
  for (const c of connectors) {
    map[c.id] = c;
  }
  return map;
}
