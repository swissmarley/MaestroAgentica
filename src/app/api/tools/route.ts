import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Default MCP server connectors
const DEFAULT_CONNECTORS = [
  {
    id: "github",
    name: "GitHub",
    description: "Access repositories, issues, pull requests, and code search via GitHub's API.",
    icon: "github",
    category: "Development",
    authType: "oauth" as const,
    authUrl: "https://github.com/login/oauth/authorize",
    mcpEndpoint: "https://api.githubcopilot.com/mcp/",
    status: "available" as const,
    tools: [
      "search_repositories", "get_file_contents", "create_issue",
      "list_pull_requests", "create_pull_request", "get_commit_history",
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, search conversations, and manage channels in your Slack workspace.",
    icon: "slack",
    category: "Communication",
    authType: "oauth" as const,
    authUrl: "https://slack.com/oauth/v2/authorize",
    mcpEndpoint: "npx -y @anthropic/mcp-server-slack",
    status: "available" as const,
    tools: [
      "send_message", "search_messages", "list_channels",
      "get_channel_history", "add_reaction",
    ],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files on the local filesystem with configurable access controls.",
    icon: "folder",
    category: "System",
    authType: "none" as const,
    mcpEndpoint: "npx -y @anthropic/mcp-server-filesystem",
    status: "available" as const,
    tools: [
      "read_file", "write_file", "list_directory",
      "create_directory", "move_file", "search_files",
    ],
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases with read/write access.",
    icon: "database",
    category: "Data",
    authType: "connection_string" as const,
    mcpEndpoint: "npx -y @anthropic/mcp-server-postgres",
    status: "available" as const,
    tools: [
      "query", "list_tables", "describe_table",
      "insert_row", "update_rows",
    ],
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Search the web using Brave Search API for real-time information retrieval.",
    icon: "search",
    category: "Search",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @anthropic/mcp-server-brave-search",
    status: "available" as const,
    tools: [
      "brave_web_search", "brave_local_search",
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Access and manage files in Google Drive, including docs, sheets, and slides.",
    icon: "cloud",
    category: "Productivity",
    authType: "oauth" as const,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    mcpEndpoint: "npx -y @anthropic/mcp-server-gdrive",
    status: "available" as const,
    tools: [
      "search_files", "read_file", "list_files",
    ],
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent knowledge graph memory for maintaining context across conversations.",
    icon: "brain",
    category: "AI",
    authType: "none" as const,
    mcpEndpoint: "npx -y @anthropic/mcp-server-memory",
    status: "available" as const,
    tools: [
      "create_entities", "create_relations", "search_nodes",
      "read_graph", "delete_entities",
    ],
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation for web scraping, screenshots, and interaction testing.",
    icon: "globe",
    category: "Automation",
    authType: "none" as const,
    mcpEndpoint: "npx -y @anthropic/mcp-server-puppeteer",
    status: "available" as const,
    tools: [
      "navigate", "screenshot", "click",
      "fill", "evaluate",
    ],
  },
];

// GET /api/tools - List available MCP connectors and custom tools
export async function GET() {
  return NextResponse.json({
    connectors: DEFAULT_CONNECTORS,
  });
}

// POST /api/tools - Create a custom tool definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, inputSchema, mcpEndpoint } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Tool name is required" },
        { status: 400 }
      );
    }

    // Return the tool config that can be added to an agent
    const toolConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || "",
      input_schema: inputSchema || { type: "object", properties: {} },
      mcpEndpoint: mcpEndpoint?.trim() || null,
      category: "Custom",
      status: "configured",
    };

    return NextResponse.json(toolConfig, { status: 201 });
  } catch (err) {
    console.error("POST /api/tools error:", err);
    return NextResponse.json(
      { error: "Failed to create tool" },
      { status: 500 }
    );
  }
}
