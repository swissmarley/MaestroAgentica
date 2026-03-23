import * as fs from "fs/promises";
import * as path from "path";
import { getChromaClient } from "@/lib/chromadb";
import { db } from "@/lib/db";

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

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the given input.
 * Returns the tool's output or an error message if the tool is not supported.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const handler = toolHandlers[toolName];
  if (handler) {
    return handler(input);
  }

  return {
    output: JSON.stringify({
      error: `Tool "${toolName}" is not available for direct execution in the playground.`,
      hint: "This tool requires an MCP server connection. Configure the MCP endpoint in the agent's tool settings.",
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

  // Map catalog tool IDs to built-in tool names
  const catalogMapping: Record<string, string[]> = {
    filesystem: ["read_file", "write_file", "list_directory", "create_directory", "move_file", "search_files"],
    memory: ["memory_query", "memory_store", "memory_list_collections"],
  };

  for (const toolId of toolIds) {
    const mappedNames = catalogMapping[toolId];
    if (mappedNames) {
      for (const name of mappedNames) {
        const def = allBuiltin.find((t) => t.name === name);
        if (def) toolDefs.push(def);
      }
    }
  }

  return toolDefs;
}
