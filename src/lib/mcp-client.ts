import { spawn, type ChildProcess } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

interface McpServerProcess {
  process: ChildProcess;
  initialized: boolean;
  connectorId: string;
  createdAt: number;
}

// ── Server Process Cache ───────────────────────────────────────────────

// Cache MCP server processes to avoid re-spawning for every tool call.
// Processes are killed after 5 minutes of inactivity.
const serverCache = new Map<string, McpServerProcess>();
const PROCESS_TTL_MS = 5 * 60 * 1000;

function cleanupStaleProcesses() {
  const now = Date.now();
  const entries = Array.from(serverCache.entries());
  for (const [key, entry] of entries) {
    if (now - entry.createdAt > PROCESS_TTL_MS) {
      try { entry.process.kill(); } catch { /* already dead */ }
      serverCache.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function ensureCleanupRunning() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupStaleProcesses, 60_000);
    // Don't block process exit
    if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
      cleanupInterval.unref();
    }
  }
}

// ── Environment Builder ────────────────────────────────────────────────

/**
 * Build the environment variables for an MCP server process based on
 * the connector ID and stored credentials.
 */
export function buildMcpEnv(
  connectorId: string,
  credentials: { apiKey?: string; connectionString?: string; oauthToken?: string }
): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  // Map connector IDs to their expected environment variables
  const envMappings: Record<string, (creds: typeof credentials) => Record<string, string>> = {
    "brave-search": (c) => ({ BRAVE_API_KEY: c.apiKey || "" }),
    github: (c) => ({ GITHUB_PERSONAL_ACCESS_TOKEN: c.apiKey || c.oauthToken || "" }),
    slack: (c) => ({ SLACK_BOT_TOKEN: c.apiKey || c.oauthToken || "" }),
    notion: (c) => ({ NOTION_API_KEY: c.apiKey || "" }),
    discord: (c) => ({ DISCORD_BOT_TOKEN: c.apiKey || "" }),
    telegram: (c) => ({ TELEGRAM_BOT_TOKEN: c.apiKey || "" }),
    stripe: (c) => ({ STRIPE_API_KEY: c.apiKey || "" }),
    cloudflare: (c) => ({ CLOUDFLARE_API_TOKEN: c.apiKey || "" }),
    airtable: (c) => ({ AIRTABLE_API_KEY: c.apiKey || "" }),
    hubspot: (c) => ({ HUBSPOT_API_KEY: c.apiKey || "" }),
    salesforce: (c) => ({ SALESFORCE_ACCESS_TOKEN: c.apiKey || c.oauthToken || "" }),
    figma: (c) => ({ FIGMA_ACCESS_TOKEN: c.apiKey || "" }),
    zapier: (c) => ({ ZAPIER_API_KEY: c.apiKey || "" }),
    asana: (c) => ({ ASANA_ACCESS_TOKEN: c.apiKey || "" }),
    jira: (c) => ({ JIRA_API_TOKEN: c.apiKey || "", JIRA_EMAIL: "" }),
    confluence: (c) => ({ CONFLUENCE_API_TOKEN: c.apiKey || "" }),
    canva: (c) => ({ CANVA_API_KEY: c.apiKey || "" }),
    paypal: (c) => ({ PAYPAL_CLIENT_ID: c.apiKey || "" }),
    "google-drive": (c) => ({ GOOGLE_ACCESS_TOKEN: c.oauthToken || c.apiKey || "" }),
    "google-calendar": (c) => ({ GOOGLE_ACCESS_TOKEN: c.oauthToken || c.apiKey || "" }),
    gmail: (c) => ({ GOOGLE_ACCESS_TOKEN: c.oauthToken || c.apiKey || "" }),
    outlook: (c) => ({ MICROSOFT_ACCESS_TOKEN: c.oauthToken || c.apiKey || "" }),
    onedrive: (c) => ({ MICROSOFT_ACCESS_TOKEN: c.oauthToken || c.apiKey || "" }),
    postgres: (c) => ({ DATABASE_URL: c.connectionString || "" }),
    mysql: (c) => ({ DATABASE_URL: c.connectionString || "" }),
    mongodb: (c) => ({ MONGODB_URI: c.connectionString || "" }),
    supabase: (c) => ({ SUPABASE_URL: c.apiKey || "", SUPABASE_ANON_KEY: c.connectionString || "" }),
    n8n: (c) => ({ N8N_API_KEY: c.apiKey || "" }),
    context7: () => ({}),
    wikipedia: () => ({}),
  };

  const mapper = envMappings[connectorId];
  if (mapper) {
    Object.assign(env, mapper(credentials));
  }

  return env;
}

// ── Command Parser ─────────────────────────────────────────────────────

/**
 * Parse an MCP endpoint string into command and args.
 * Supports both "npx -y @package/name" and URL-based endpoints.
 */
function parseCommand(mcpEndpoint: string): { command: string; args: string[] } {
  const parts = mcpEndpoint.trim().split(/\s+/);
  return {
    command: parts[0],
    args: parts.slice(1),
  };
}

// ── JSON-RPC Communication ─────────────────────────────────────────────

/**
 * Send a JSON-RPC request to an MCP server process and wait for the response.
 */
function sendRequest(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`MCP request timed out after ${timeoutMs}ms for method: ${method}`));
    }, timeoutMs);

    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();

      // MCP uses newline-delimited JSON
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as JsonRpcResponse;
          if (parsed.id === id) {
            cleanup();
            resolve(parsed);
            return;
          }
        } catch {
          // Not valid JSON, skip (could be log output)
        }
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout?.removeListener("data", onData);
      proc.stderr?.removeListener("data", onError);
    };

    proc.stdout?.on("data", onData);
    // Don't reject on stderr — many MCP servers log to stderr
    proc.stderr?.on("data", () => { /* ignore stderr log output */ });

    const requestStr = JSON.stringify(request) + "\n";
    proc.stdin?.write(requestStr);
  });
}

/**
 * Send a JSON-RPC notification (no response expected).
 */
function sendNotification(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>
) {
  const notification = {
    jsonrpc: "2.0",
    method,
    ...(params !== undefined ? { params } : {}),
  };
  proc.stdin?.write(JSON.stringify(notification) + "\n");
}

// ── MCP Server Lifecycle ───────────────────────────────────────────────

/**
 * Spawn and initialize an MCP server process.
 */
async function spawnMcpServer(
  mcpEndpoint: string,
  connectorId: string,
  env: Record<string, string>
): Promise<McpServerProcess> {
  const { command, args } = parseCommand(mcpEndpoint);

  const proc = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: env as NodeJS.ProcessEnv,
    shell: true,
  }) as ChildProcess;

  // Handle process errors
  proc.on("error", (err: Error) => {
    console.error(`MCP server ${connectorId} error:`, err.message);
    serverCache.delete(connectorId);
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`MCP server ${connectorId} exited with code ${code}`);
    }
    serverCache.delete(connectorId);
  });

  const entry: McpServerProcess = {
    process: proc,
    initialized: false,
    connectorId,
    createdAt: Date.now(),
  };

  // Initialize the MCP protocol
  try {
    const initResponse = await sendRequest(proc, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "maestro-agentica",
        version: "1.0.0",
      },
    }, 60_000); // 60s timeout for init (npx cold-start can be slow)

    if (initResponse.error) {
      throw new Error(`MCP init failed: ${initResponse.error.message}`);
    }

    // Send initialized notification
    sendNotification(proc, "notifications/initialized");
    entry.initialized = true;
  } catch (err) {
    // Kill process on failed init
    try { proc.kill(); } catch { /* ignore */ }
    throw err;
  }

  return entry;
}

/**
 * Get or create a cached MCP server process.
 */
async function getOrCreateServer(
  mcpEndpoint: string,
  connectorId: string,
  env: Record<string, string>
): Promise<McpServerProcess> {
  ensureCleanupRunning();

  const cached = serverCache.get(connectorId);
  if (cached && cached.initialized && !cached.process.killed) {
    // Refresh TTL
    cached.createdAt = Date.now();
    return cached;
  }

  // Spawn a new server
  const server = await spawnMcpServer(mcpEndpoint, connectorId, env);
  serverCache.set(connectorId, server);
  return server;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Call a tool on an MCP server. Handles spawning, initialization, and
 * executing the tool call via JSON-RPC.
 */
export async function callMcpTool(
  mcpEndpoint: string,
  connectorId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  credentials: { apiKey?: string; connectionString?: string; oauthToken?: string }
): Promise<McpToolResult> {
  const env = buildMcpEnv(connectorId, credentials);

  let server: McpServerProcess;
  try {
    server = await getOrCreateServer(mcpEndpoint, connectorId, env);
  } catch (err) {
    return {
      content: [{
        type: "text",
        text: `Failed to start MCP server for ${connectorId}: ${err instanceof Error ? err.message : String(err)}. Make sure the MCP server package is installed and the tool is properly connected with valid credentials.`,
      }],
      isError: true,
    };
  }

  try {
    const response = await sendRequest(server.process, "tools/call", {
      name: toolName,
      arguments: toolInput,
    });

    if (response.error) {
      return {
        content: [{
          type: "text",
          text: `MCP tool error: ${response.error.message}`,
        }],
        isError: true,
      };
    }

    const result = response.result as McpToolResult | undefined;
    if (result && result.content) {
      return result;
    }

    // Some servers return the result directly as text
    return {
      content: [{
        type: "text",
        text: typeof response.result === "string"
          ? response.result
          : JSON.stringify(response.result, null, 2),
      }],
    };
  } catch (err) {
    // If the process died, remove from cache so it restarts next time
    serverCache.delete(connectorId);
    try { server.process.kill(); } catch { /* ignore */ }

    return {
      content: [{
        type: "text",
        text: `MCP tool call failed for ${toolName}: ${err instanceof Error ? err.message : String(err)}`,
      }],
      isError: true,
    };
  }
}

/**
 * Kill all cached MCP server processes. Call on shutdown.
 */
export function shutdownAllMcpServers() {
  const entries = Array.from(serverCache.entries());
  for (const [key, entry] of entries) {
    try { entry.process.kill(); } catch { /* ignore */ }
    serverCache.delete(key);
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
