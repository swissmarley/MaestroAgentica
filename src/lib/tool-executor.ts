import * as fs from "fs/promises";
import * as path from "path";
import { getChromaClient } from "@/lib/chromadb";
import { db } from "@/lib/db";
// Dynamic import to avoid child_process issues during Next.js page collection
async function callMcpToolDynamic(
  mcpEndpoint: string,
  connectorId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  credentials: { apiKey?: string; connectionString?: string; oauthToken?: string }
) {
  const { callMcpTool } = await import("@/lib/mcp-client");
  return callMcpTool(mcpEndpoint, connectorId, toolName, toolInput, credentials);
}

// ── Types ──────────────────────────────────────────────────────────────

export interface ToolResult {
  output: string;
  isError: boolean;
}

type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

// ── Sandbox root for filesystem operations ─────────────────────────────

const SANDBOX_ROOT = path.resolve(process.cwd(), "agent-sandbox");

async function ensureSandbox() {
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  } catch {
    // already exists
  }
}

function sandboxPath(filePath: string): string {
  const resolved = path.resolve(SANDBOX_ROOT, filePath.replace(/^\/+/, ""));
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error("Path escapes sandbox directory");
  }
  return resolved;
}

// ── Built-in Tool Handlers ─────────────────────────────────────────────

const toolHandlers: Record<string, ToolHandler> = {
  // ── Filesystem Tools ──────────────────────────────────────────────────

  read_file: async (input) => {
    try {
      await ensureSandbox();
      const filePath = sandboxPath(input.path as string);
      const content = await fs.readFile(filePath, "utf-8");
      return { output: content, isError: false };
    } catch (err) {
      return {
        output: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  write_file: async (input) => {
    try {
      await ensureSandbox();
      const filePath = sandboxPath(input.path as string);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, input.content as string, "utf-8");
      return {
        output: JSON.stringify({
          success: true,
          path: filePath.replace(SANDBOX_ROOT, "/sandbox"),
          size: (input.content as string).length,
        }),
        isError: false,
      };
    } catch (err) {
      return {
        output: `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  list_directory: async (input) => {
    try {
      await ensureSandbox();
      const dirPath = sandboxPath((input.path as string) || "/");
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return { output: JSON.stringify(items, null, 2), isError: false };
    } catch (err) {
      return {
        output: `Error listing directory: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  create_directory: async (input) => {
    try {
      await ensureSandbox();
      const dirPath = sandboxPath(input.path as string);
      await fs.mkdir(dirPath, { recursive: true });
      return {
        output: JSON.stringify({ success: true, path: dirPath.replace(SANDBOX_ROOT, "/sandbox") }),
        isError: false,
      };
    } catch (err) {
      return {
        output: `Error creating directory: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  move_file: async (input) => {
    try {
      await ensureSandbox();
      const src = sandboxPath(input.source as string);
      const dest = sandboxPath(input.destination as string);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(src, dest);
      return {
        output: JSON.stringify({ success: true, from: input.source, to: input.destination }),
        isError: false,
      };
    } catch (err) {
      return {
        output: `Error moving file: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  search_files: async (input) => {
    try {
      await ensureSandbox();
      const searchDir = sandboxPath((input.path as string) || "/");
      const pattern = (input.pattern as string) || "";
      const results: string[] = [];

      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.name.includes(pattern)) {
            results.push(fullPath.replace(SANDBOX_ROOT, ""));
          }
        }
      };

      await walk(searchDir);
      return { output: JSON.stringify(results, null, 2), isError: false };
    } catch (err) {
      return {
        output: `Error searching files: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  // ── Memory Tools ──────────────────────────────────────────────────────

  memory_query: async (input) => {
    try {
      const query = input.query as string;
      const collectionId = input.collection_id as string | undefined;
      const nResults = (input.n_results as number) || 5;

      const chroma = getChromaClient();

      if (collectionId) {
        // Query a specific collection
        const memCol = await db.memoryCollection.findUnique({
          where: { id: collectionId },
        });
        if (!memCol) {
          return { output: `Memory collection not found: ${collectionId}`, isError: true };
        }
        const collection = await chroma.getCollection({ name: memCol.chromaId });
        const results = await collection.query({
          queryTexts: [query],
          nResults,
        });
        return {
          output: JSON.stringify({
            collection: memCol.name,
            results: results.documents?.[0] || [],
            distances: results.distances?.[0] || [],
          }, null, 2),
          isError: false,
        };
      } else {
        // Query all collections
        return {
          output: JSON.stringify({
            error: "Please specify a collection_id to query. Use memory_list_collections to see available collections.",
          }),
          isError: true,
        };
      }
    } catch (err) {
      return {
        output: `Error querying memory: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  memory_store: async (input) => {
    try {
      const collectionId = input.collection_id as string;
      const content = input.content as string;
      const metadata = (input.metadata as Record<string, string>) || {};

      const memCol = await db.memoryCollection.findUnique({
        where: { id: collectionId },
      });
      if (!memCol) {
        return { output: `Memory collection not found: ${collectionId}`, isError: true };
      }

      const chroma = getChromaClient();
      const collection = await chroma.getCollection({ name: memCol.chromaId });
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await collection.add({
        ids: [docId],
        documents: [content],
        metadatas: [metadata],
      });

      return {
        output: JSON.stringify({
          success: true,
          collection: memCol.name,
          documentId: docId,
        }),
        isError: false,
      };
    } catch (err) {
      return {
        output: `Error storing to memory: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },

  memory_list_collections: async () => {
    try {
      const collections = await db.memoryCollection.findMany({
        include: { _count: { select: { documents: true } } },
      });
      return {
        output: JSON.stringify(
          collections.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            documentCount: c._count.documents,
          })),
          null,
          2
        ),
        isError: false,
      };
    } catch (err) {
      return {
        output: `Error listing collections: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};

// ── Tool-to-Connector Mapping ──────────────────────────────────────────

/**
 * Build a reverse map from tool names to connector IDs (lazy-initialized).
 */
let _toolToConnectorMap: Record<string, string> | null = null;

function getToolToConnectorMap(): Record<string, string> {
  if (!_toolToConnectorMap) {
    _toolToConnectorMap = {};
    for (const [connectorId, tools] of Object.entries(CONNECTOR_TOOLS)) {
      for (const tool of tools) {
        _toolToConnectorMap[tool.name] = connectorId;
      }
    }
  }
  return _toolToConnectorMap;
}

// ── Connection context for MCP tools ───────────────────────────────────

export interface ToolConnectionInfo {
  connected: boolean;
  authType: string;
  apiKey?: string;
  connectionString?: string;
  oauthToken?: string;
}

export interface McpConnectorInfo {
  id: string;
  mcpEndpoint: string;
}

export interface ToolExecutionContext {
  /** Map of connector ID → connection credentials */
  connections: Record<string, ToolConnectionInfo>;
  /** Map of connector ID → MCP endpoint info */
  connectors: Record<string, McpConnectorInfo>;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the given input.
 * First tries local handlers (filesystem, memory), then routes to MCP servers.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: ToolExecutionContext
): Promise<ToolResult> {
  // 1. Check local handlers first (filesystem, memory)
  const handler = toolHandlers[toolName];
  if (handler) {
    return handler(input);
  }

  // 2. Try MCP execution via connector
  const connectorId = getToolToConnectorMap()[toolName];
  if (connectorId && context) {
    const connection = context.connections[connectorId];
    const connector = context.connectors[connectorId];

    if (!connection?.connected) {
      return {
        output: JSON.stringify({
          error: `Tool "${toolName}" requires the ${connectorId} connector to be connected.`,
          hint: `Go to Tools page and connect ${connectorId} with the required credentials.`,
        }),
        isError: true,
      };
    }

    if (!connector?.mcpEndpoint) {
      return {
        output: JSON.stringify({
          error: `No MCP endpoint configured for connector ${connectorId}.`,
        }),
        isError: true,
      };
    }

    // Call the MCP server
    const mcpResult = await callMcpToolDynamic(
      connector.mcpEndpoint,
      connectorId,
      toolName,
      input,
      {
        apiKey: connection.apiKey,
        connectionString: connection.connectionString,
        oauthToken: connection.oauthToken,
      }
    );

    // Convert MCP result to ToolResult
    const outputText = mcpResult.content
      .map((block) => block.text || JSON.stringify(block))
      .join("\n");

    return {
      output: outputText,
      isError: mcpResult.isError || false,
    };
  }

  // 3. Tool not found anywhere
  if (connectorId && !context) {
    return {
      output: JSON.stringify({
        error: `Tool "${toolName}" requires the ${connectorId} connector. Ensure the tool is connected on the Tools page.`,
        hint: "The tool connection could not be verified. Connect the tool and try again.",
      }),
      isError: true,
    };
  }

  return {
    output: JSON.stringify({
      error: `Tool "${toolName}" is not recognized.`,
      hint: "This tool is not in the built-in catalog. Check the tool name or configure a custom MCP endpoint.",
    }),
    isError: true,
  };
}

/**
 * Check if a tool can be executed directly (vs. requiring MCP).
 */
export function isExecutableTool(toolName: string): boolean {
  return toolName in toolHandlers;
}

/**
 * Check if a tool exists in the connector catalog (may need MCP).
 */
export function isConnectorTool(toolName: string): boolean {
  return toolName in getToolToConnectorMap();
}

/**
 * Get the connector ID for a given tool name, if any.
 */
export function getConnectorIdForTool(toolName: string): string | undefined {
  return getToolToConnectorMap()[toolName];
}

/**
 * Get all built-in tool definitions that can be registered with Claude.
 */
export function getBuiltinToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return [
    {
      name: "read_file",
      description: "Read the contents of a file from the agent's sandbox filesystem.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to sandbox root" },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write content to a file in the agent's sandbox filesystem. Creates parent directories if needed.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to sandbox root" },
          content: { type: "string", description: "Content to write to the file" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "list_directory",
      description: "List files and directories at a given path in the agent's sandbox.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path relative to sandbox root (default: root)" },
        },
        required: [],
      },
    },
    {
      name: "create_directory",
      description: "Create a directory (and parent directories) in the agent's sandbox.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to create" },
        },
        required: ["path"],
      },
    },
    {
      name: "move_file",
      description: "Move or rename a file in the agent's sandbox.",
      input_schema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Current file path" },
          destination: { type: "string", description: "New file path" },
        },
        required: ["source", "destination"],
      },
    },
    {
      name: "search_files",
      description: "Search for files matching a pattern in the agent's sandbox.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to search in (default: root)" },
          pattern: { type: "string", description: "Filename pattern to match" },
        },
        required: ["pattern"],
      },
    },
    {
      name: "memory_query",
      description: "Search the agent's memory collections using semantic search. Returns the most relevant stored documents.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          collection_id: { type: "string", description: "ID of the memory collection to search" },
          n_results: { type: "number", description: "Number of results to return (default: 5)" },
        },
        required: ["query"],
      },
    },
    {
      name: "memory_store",
      description: "Store information in the agent's memory for future retrieval.",
      input_schema: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "ID of the memory collection to store in" },
          content: { type: "string", description: "The content to store" },
          metadata: { type: "object", description: "Optional metadata key-value pairs" },
        },
        required: ["collection_id", "content"],
      },
    },
    {
      name: "memory_list_collections",
      description: "List all available memory collections the agent can access.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Connector tool catalog — maps connector IDs to their tool names and descriptions.
 * Tools that have a handler in `toolHandlers` will be executed locally;
 * all others are registered with Claude so the agent can invoke them and
 * the result (or a helpful error) is returned.
 */
const CONNECTOR_TOOLS: Record<
  string,
  Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
> = {
  github: [
    { name: "search_repositories", description: "Search GitHub repositories by query.", input_schema: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"] } },
    { name: "get_file_contents", description: "Get the contents of a file from a GitHub repository.", input_schema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" } }, required: ["owner", "repo", "path"] } },
    { name: "create_issue", description: "Create a new issue in a GitHub repository.", input_schema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["owner", "repo", "title"] } },
    { name: "list_pull_requests", description: "List pull requests for a repository.", input_schema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, state: { type: "string", description: "open, closed, or all" } }, required: ["owner", "repo"] } },
    { name: "create_pull_request", description: "Create a pull request.", input_schema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" }, head: { type: "string" }, base: { type: "string" } }, required: ["owner", "repo", "title", "head", "base"] } },
    { name: "get_commit_history", description: "Get recent commit history for a repository.", input_schema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, limit: { type: "number" } }, required: ["owner", "repo"] } },
  ],
  slack: [
    { name: "send_message", description: "Send a message to a Slack channel.", input_schema: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] } },
    { name: "search_messages", description: "Search Slack messages.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "list_channels", description: "List Slack channels.", input_schema: { type: "object", properties: {} } },
    { name: "get_channel_history", description: "Get message history from a Slack channel.", input_schema: { type: "object", properties: { channel: { type: "string" }, limit: { type: "number" } }, required: ["channel"] } },
    { name: "add_reaction", description: "Add a reaction emoji to a message.", input_schema: { type: "object", properties: { channel: { type: "string" }, timestamp: { type: "string" }, name: { type: "string" } }, required: ["channel", "timestamp", "name"] } },
  ],
  wikipedia: [
    { name: "search_articles", description: "Search Wikipedia for articles matching a query.", input_schema: { type: "object", properties: { query: { type: "string", description: "Search query" }, limit: { type: "number", description: "Max results (default 5)" } }, required: ["query"] } },
    { name: "get_article", description: "Get the full content of a Wikipedia article.", input_schema: { type: "object", properties: { title: { type: "string", description: "Article title" } }, required: ["title"] } },
    { name: "get_summary", description: "Get a brief summary of a Wikipedia article.", input_schema: { type: "object", properties: { title: { type: "string", description: "Article title" } }, required: ["title"] } },
    { name: "get_sections", description: "Get the section structure of a Wikipedia article.", input_schema: { type: "object", properties: { title: { type: "string", description: "Article title" } }, required: ["title"] } },
    { name: "get_links", description: "Get links from a Wikipedia article.", input_schema: { type: "object", properties: { title: { type: "string", description: "Article title" } }, required: ["title"] } },
    { name: "get_categories", description: "Get categories of a Wikipedia article.", input_schema: { type: "object", properties: { title: { type: "string", description: "Article title" } }, required: ["title"] } },
  ],
  "brave-search": [
    { name: "brave_web_search", description: "Search the web using Brave Search.", input_schema: { type: "object", properties: { query: { type: "string" }, count: { type: "number" } }, required: ["query"] } },
    { name: "brave_local_search", description: "Search for local businesses and places.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
  "google-drive": [
    { name: "gdrive_search_files", description: "Search files in Google Drive.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "gdrive_read_file", description: "Read a file from Google Drive.", input_schema: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"] } },
    { name: "gdrive_list_files", description: "List files in Google Drive.", input_schema: { type: "object", properties: { folder_id: { type: "string" } } } },
  ],
  notion: [
    { name: "search_pages", description: "Search Notion pages.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "read_page", description: "Read a Notion page.", input_schema: { type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"] } },
    { name: "create_page", description: "Create a Notion page.", input_schema: { type: "object", properties: { parent_id: { type: "string" }, title: { type: "string" }, content: { type: "string" } }, required: ["parent_id", "title"] } },
    { name: "update_page", description: "Update a Notion page.", input_schema: { type: "object", properties: { page_id: { type: "string" }, properties: { type: "object" } }, required: ["page_id"] } },
    { name: "query_database", description: "Query a Notion database.", input_schema: { type: "object", properties: { database_id: { type: "string" }, filter: { type: "object" } }, required: ["database_id"] } },
    { name: "create_database", description: "Create a Notion database.", input_schema: { type: "object", properties: { parent_id: { type: "string" }, title: { type: "string" }, properties: { type: "object" } }, required: ["parent_id", "title"] } },
  ],
  puppeteer: [
    { name: "navigate", description: "Navigate the browser to a URL.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
    { name: "screenshot", description: "Take a screenshot of the current page.", input_schema: { type: "object", properties: { selector: { type: "string" } } } },
    { name: "click", description: "Click an element on the page.", input_schema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] } },
    { name: "fill", description: "Fill an input field.", input_schema: { type: "object", properties: { selector: { type: "string" }, value: { type: "string" } }, required: ["selector", "value"] } },
    { name: "evaluate", description: "Execute JavaScript in the browser.", input_schema: { type: "object", properties: { script: { type: "string" } }, required: ["script"] } },
  ],
  discord: [
    { name: "discord_send_message", description: "Send a message to a Discord channel.", input_schema: { type: "object", properties: { channel_id: { type: "string" }, content: { type: "string" } }, required: ["channel_id", "content"] } },
    { name: "discord_read_messages", description: "Read messages from a Discord channel.", input_schema: { type: "object", properties: { channel_id: { type: "string" }, limit: { type: "number" } }, required: ["channel_id"] } },
    { name: "discord_list_channels", description: "List channels in a Discord server.", input_schema: { type: "object", properties: { guild_id: { type: "string" } }, required: ["guild_id"] } },
  ],
  telegram: [
    { name: "telegram_send_message", description: "Send a message via Telegram bot.", input_schema: { type: "object", properties: { chat_id: { type: "string" }, text: { type: "string" } }, required: ["chat_id", "text"] } },
    { name: "telegram_get_updates", description: "Get recent updates from Telegram.", input_schema: { type: "object", properties: { limit: { type: "number" } } } },
  ],
  outlook: [
    { name: "outlook_send_email", description: "Send an email via Outlook.", input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
    { name: "outlook_read_inbox", description: "Read recent emails from Outlook inbox.", input_schema: { type: "object", properties: { limit: { type: "number" } } } },
    { name: "outlook_search_emails", description: "Search Outlook emails.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
  gmail: [
    { name: "gmail_send_email", description: "Send an email via Gmail.", input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
    { name: "gmail_read_inbox", description: "Read recent emails from Gmail inbox.", input_schema: { type: "object", properties: { limit: { type: "number" } } } },
    { name: "gmail_search_emails", description: "Search Gmail emails.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
  postgres: [
    { name: "pg_query", description: "Execute a SQL query on PostgreSQL.", input_schema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
    { name: "pg_list_tables", description: "List tables in the PostgreSQL database.", input_schema: { type: "object", properties: {} } },
    { name: "pg_describe_table", description: "Describe a PostgreSQL table schema.", input_schema: { type: "object", properties: { table: { type: "string" } }, required: ["table"] } },
  ],
  context7: [
    { name: "resolve_library_id", description: "Resolve a library name to its Context7 ID.", input_schema: { type: "object", properties: { library_name: { type: "string" } }, required: ["library_name"] } },
    { name: "get_library_docs", description: "Get documentation for a library from Context7.", input_schema: { type: "object", properties: { library_id: { type: "string" }, topic: { type: "string" } }, required: ["library_id"] } },
  ],
  stripe: [
    { name: "stripe_list_customers", description: "List Stripe customers.", input_schema: { type: "object", properties: { limit: { type: "number" } } } },
    { name: "stripe_create_payment_intent", description: "Create a Stripe payment intent.", input_schema: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } }, required: ["amount", "currency"] } },
    { name: "stripe_get_balance", description: "Get Stripe account balance.", input_schema: { type: "object", properties: {} } },
  ],
  cloudflare: [
    { name: "cf_list_zones", description: "List Cloudflare zones.", input_schema: { type: "object", properties: {} } },
    { name: "cf_create_dns_record", description: "Create a DNS record.", input_schema: { type: "object", properties: { zone_id: { type: "string" }, type: { type: "string" }, name: { type: "string" }, content: { type: "string" } }, required: ["zone_id", "type", "name", "content"] } },
  ],
  airtable: [
    { name: "airtable_list_records", description: "List records in an Airtable table.", input_schema: { type: "object", properties: { base_id: { type: "string" }, table_name: { type: "string" } }, required: ["base_id", "table_name"] } },
    { name: "airtable_create_record", description: "Create a record in Airtable.", input_schema: { type: "object", properties: { base_id: { type: "string" }, table_name: { type: "string" }, fields: { type: "object" } }, required: ["base_id", "table_name", "fields"] } },
  ],
  hubspot: [
    { name: "hubspot_list_contacts", description: "List HubSpot contacts.", input_schema: { type: "object", properties: { limit: { type: "number" } } } },
    { name: "hubspot_create_contact", description: "Create a HubSpot contact.", input_schema: { type: "object", properties: { email: { type: "string" }, firstname: { type: "string" }, lastname: { type: "string" } }, required: ["email"] } },
    { name: "hubspot_search_crm", description: "Search HubSpot CRM.", input_schema: { type: "object", properties: { query: { type: "string" }, object_type: { type: "string" } }, required: ["query"] } },
  ],
  salesforce: [
    { name: "sf_query_soql", description: "Execute a SOQL query on Salesforce.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "sf_create_record", description: "Create a Salesforce record.", input_schema: { type: "object", properties: { object_type: { type: "string" }, fields: { type: "object" } }, required: ["object_type", "fields"] } },
  ],
  supabase: [
    { name: "supabase_query_table", description: "Query a Supabase table.", input_schema: { type: "object", properties: { table: { type: "string" }, select: { type: "string" }, filter: { type: "object" } }, required: ["table"] } },
    { name: "supabase_insert_rows", description: "Insert rows into a Supabase table.", input_schema: { type: "object", properties: { table: { type: "string" }, rows: { type: "array" } }, required: ["table", "rows"] } },
  ],
  mongodb: [
    { name: "mongo_find_documents", description: "Find documents in a MongoDB collection.", input_schema: { type: "object", properties: { collection: { type: "string" }, filter: { type: "object" }, limit: { type: "number" } }, required: ["collection"] } },
    { name: "mongo_insert_document", description: "Insert a document into MongoDB.", input_schema: { type: "object", properties: { collection: { type: "string" }, document: { type: "object" } }, required: ["collection", "document"] } },
  ],
  mysql: [
    { name: "mysql_query", description: "Execute a SQL query on MySQL.", input_schema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
    { name: "mysql_list_tables", description: "List tables in the MySQL database.", input_schema: { type: "object", properties: {} } },
  ],
  figma: [
    { name: "figma_get_file", description: "Get a Figma file.", input_schema: { type: "object", properties: { file_key: { type: "string" } }, required: ["file_key"] } },
    { name: "figma_get_components", description: "Get components from a Figma file.", input_schema: { type: "object", properties: { file_key: { type: "string" } }, required: ["file_key"] } },
  ],
  zapier: [
    { name: "zapier_list_actions", description: "List available Zapier actions.", input_schema: { type: "object", properties: {} } },
    { name: "zapier_execute_action", description: "Execute a Zapier action.", input_schema: { type: "object", properties: { action_id: { type: "string" }, params: { type: "object" } }, required: ["action_id"] } },
  ],
  "google-calendar": [
    { name: "gcal_list_events", description: "List Google Calendar events.", input_schema: { type: "object", properties: { calendar_id: { type: "string" }, time_min: { type: "string" }, time_max: { type: "string" } } } },
    { name: "gcal_create_event", description: "Create a Google Calendar event.", input_schema: { type: "object", properties: { calendar_id: { type: "string" }, summary: { type: "string" }, start: { type: "string" }, end: { type: "string" } }, required: ["summary", "start", "end"] } },
  ],
  onedrive: [
    { name: "onedrive_list_files", description: "List files in OneDrive.", input_schema: { type: "object", properties: { folder_path: { type: "string" } } } },
    { name: "onedrive_upload_file", description: "Upload a file to OneDrive.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "onedrive_search_files", description: "Search for files in OneDrive.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
  canva: [
    { name: "canva_create_design", description: "Create a new Canva design.", input_schema: { type: "object", properties: { title: { type: "string" }, template_id: { type: "string" } }, required: ["title"] } },
    { name: "canva_list_templates", description: "List available Canva templates.", input_schema: { type: "object", properties: { query: { type: "string" } } } },
  ],
  paypal: [
    { name: "paypal_create_order", description: "Create a PayPal order.", input_schema: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } }, required: ["amount", "currency"] } },
    { name: "paypal_list_transactions", description: "List PayPal transactions.", input_schema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" } } } },
  ],
  asana: [
    { name: "asana_list_tasks", description: "List tasks in an Asana project.", input_schema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
    { name: "asana_create_task", description: "Create an Asana task.", input_schema: { type: "object", properties: { project_id: { type: "string" }, name: { type: "string" }, notes: { type: "string" } }, required: ["project_id", "name"] } },
  ],
  jira: [
    { name: "jira_search_issues", description: "Search Jira issues with JQL.", input_schema: { type: "object", properties: { jql: { type: "string" } }, required: ["jql"] } },
    { name: "jira_create_issue", description: "Create a Jira issue.", input_schema: { type: "object", properties: { project_key: { type: "string" }, summary: { type: "string" }, issue_type: { type: "string" }, description: { type: "string" } }, required: ["project_key", "summary", "issue_type"] } },
  ],
  confluence: [
    { name: "confluence_search", description: "Search Confluence content.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "confluence_get_page", description: "Get a Confluence page.", input_schema: { type: "object", properties: { page_id: { type: "string" } }, required: ["page_id"] } },
    { name: "confluence_create_page", description: "Create a Confluence page.", input_schema: { type: "object", properties: { space_key: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["space_key", "title", "body"] } },
  ],
  n8n: [
    { name: "n8n_trigger_workflow", description: "Trigger an n8n workflow.", input_schema: { type: "object", properties: { workflow_id: { type: "string" }, data: { type: "object" } }, required: ["workflow_id"] } },
    { name: "n8n_list_workflows", description: "List n8n workflows.", input_schema: { type: "object", properties: {} } },
  ],
};

/**
 * Get tool definitions for specific tool IDs (from the tools catalog).
 * Maps tool catalog IDs to actual executable tool definitions.
 */
export function getToolDefinitionsForIds(toolIds: string[]): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  const allBuiltin = getBuiltinToolDefinitions();
  const toolDefs: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> = [];

  // Map catalog tool IDs to built-in tool names (locally executable tools)
  const localMapping: Record<string, string[]> = {
    filesystem: ["read_file", "write_file", "list_directory", "create_directory", "move_file", "search_files"],
    memory: ["memory_query", "memory_store", "memory_list_collections"],
  };

  for (const toolId of toolIds) {
    // First check for locally executable tools
    const localNames = localMapping[toolId];
    if (localNames) {
      for (const name of localNames) {
        const def = allBuiltin.find((t) => t.name === name);
        if (def && !toolDefs.some((d) => d.name === def.name)) {
          toolDefs.push(def);
        }
      }
      continue;
    }

    // Then check connector tool catalog for MCP/external tools
    const connectorDefs = CONNECTOR_TOOLS[toolId];
    if (connectorDefs) {
      for (const def of connectorDefs) {
        if (!toolDefs.some((d) => d.name === def.name)) {
          toolDefs.push(def);
        }
      }
    }
  }

  return toolDefs;
}
