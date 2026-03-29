import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Default MCP server connectors
const DEFAULT_CONNECTORS = [
  // ─── Existing connectors ───
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-slack",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-filesystem",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-postgres",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-brave-search",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-gdrive",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-memory",
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
    mcpEndpoint: "npx -y @modelcontextprotocol/server-puppeteer",
    status: "available" as const,
    tools: [
      "navigate", "screenshot", "click",
      "fill", "evaluate",
    ],
  },

  // ─── New connectors ───

  {
    id: "outlook",
    name: "Outlook",
    description: "Read and send emails, manage calendar events, and access contacts via Microsoft Outlook.",
    icon: "outlook",
    category: "Communication",
    authType: "oauth" as const,
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-outlook",
    status: "available" as const,
    tools: [
      "send_email", "read_inbox", "search_emails",
      "list_calendar_events", "create_calendar_event", "list_contacts",
    ],
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Access, upload, and manage files stored in Microsoft OneDrive cloud storage.",
    icon: "onedrive",
    category: "Productivity",
    authType: "oauth" as const,
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-onedrive",
    status: "available" as const,
    tools: [
      "list_files", "upload_file", "download_file",
      "search_files", "create_folder", "share_file",
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read, send, and manage emails in your Gmail account with full label and thread support.",
    icon: "gmail",
    category: "Communication",
    authType: "oauth" as const,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-gmail",
    status: "available" as const,
    tools: [
      "send_email", "read_inbox", "search_emails",
      "get_thread", "create_label", "modify_labels",
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Create, read, and manage events across your Google Calendar accounts.",
    icon: "google-calendar",
    category: "Productivity",
    authType: "oauth" as const,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-google-calendar",
    status: "available" as const,
    tools: [
      "list_events", "create_event", "update_event",
      "delete_event", "list_calendars", "find_free_time",
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read, create, and update pages, databases, and blocks in your Notion workspace.",
    icon: "notion",
    category: "Productivity",
    authType: "oauth" as const,
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-notion",
    status: "available" as const,
    tools: [
      "search_pages", "read_page", "create_page",
      "update_page", "query_database", "create_database",
    ],
  },
  {
    id: "discord",
    name: "Discord",
    description: "Send messages, manage channels, and interact with your Discord server via bot integration.",
    icon: "discord",
    category: "Communication",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-discord",
    status: "available" as const,
    tools: [
      "send_message", "read_messages", "list_channels",
      "list_guild_members", "create_channel", "add_reaction",
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Send and receive messages, manage groups, and handle media through the Telegram Bot API.",
    icon: "telegram",
    category: "Communication",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-telegram",
    status: "available" as const,
    tools: [
      "send_message", "get_updates", "send_photo",
      "get_chat", "set_webhook", "edit_message",
    ],
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Read, create, and update records in Airtable bases and tables.",
    icon: "airtable",
    category: "Productivity",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-airtable",
    status: "available" as const,
    tools: [
      "list_records", "create_record", "update_record",
      "delete_record", "list_bases", "list_tables",
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Manage contacts, deals, companies, and pipelines in your HubSpot CRM.",
    icon: "hubspot",
    category: "CRM",
    authType: "oauth" as const,
    authUrl: "https://app.hubspot.com/oauth/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-hubspot",
    status: "available" as const,
    tools: [
      "list_contacts", "create_contact", "update_contact",
      "list_deals", "create_deal", "search_crm",
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Query records, manage objects, and automate workflows in Salesforce CRM.",
    icon: "salesforce",
    category: "CRM",
    authType: "oauth" as const,
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-salesforce",
    status: "available" as const,
    tools: [
      "query_soql", "create_record", "update_record",
      "delete_record", "describe_object", "search_sosl",
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Query tables, manage storage, and invoke edge functions in your Supabase project.",
    icon: "supabase",
    category: "Data",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-supabase",
    status: "available" as const,
    tools: [
      "query_table", "insert_rows", "update_rows",
      "delete_rows", "upload_file", "invoke_function",
    ],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Query, insert, update, and aggregate documents in your MongoDB databases.",
    icon: "mongodb",
    category: "Data",
    authType: "connection_string" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-mongodb",
    status: "available" as const,
    tools: [
      "find_documents", "insert_document", "update_document",
      "delete_document", "aggregate", "list_collections",
    ],
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Execute queries, manage tables, and perform operations on MySQL databases.",
    icon: "mysql",
    category: "Data",
    authType: "connection_string" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-mysql",
    status: "available" as const,
    tools: [
      "query", "list_tables", "describe_table",
      "insert_row", "update_rows", "execute_sql",
    ],
  },
  {
    id: "figma",
    name: "Figma",
    description: "Access design files, components, and styles from your Figma projects.",
    icon: "figma",
    category: "Design",
    authType: "oauth" as const,
    authUrl: "https://www.figma.com/oauth",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-figma",
    status: "available" as const,
    tools: [
      "get_file", "get_components", "get_styles",
      "get_comments", "export_nodes", "list_projects",
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Trigger Zaps, list available actions, and manage automations through Zapier's NLA API.",
    icon: "zapier",
    category: "Automation",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-zapier",
    status: "available" as const,
    tools: [
      "list_actions", "execute_action", "get_action_status",
      "list_zaps", "enable_zap", "disable_zap",
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Manage DNS records, Workers, KV namespaces, and security settings on Cloudflare.",
    icon: "cloudflare",
    category: "Infrastructure",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-cloudflare",
    status: "available" as const,
    tools: [
      "list_zones", "create_dns_record", "list_workers",
      "deploy_worker", "kv_read", "kv_write",
    ],
  },
  {
    id: "canva",
    name: "Canva",
    description: "Create designs, manage templates, and export assets using the Canva API.",
    icon: "canva",
    category: "Design",
    authType: "oauth" as const,
    authUrl: "https://www.canva.com/api/oauth/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-canva",
    status: "available" as const,
    tools: [
      "create_design", "list_templates", "export_design",
      "upload_asset", "list_folders", "share_design",
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Manage payments, customers, subscriptions, and invoices through the Stripe API.",
    icon: "stripe",
    category: "Finance",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-stripe",
    status: "available" as const,
    tools: [
      "list_customers", "create_payment_intent", "list_subscriptions",
      "create_invoice", "get_balance", "list_charges",
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Process payments, manage orders, and handle payouts via the PayPal API.",
    icon: "paypal",
    category: "Finance",
    authType: "oauth" as const,
    authUrl: "https://www.paypal.com/signin/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-paypal",
    status: "available" as const,
    tools: [
      "create_order", "capture_payment", "list_transactions",
      "create_payout", "get_balance", "issue_refund",
    ],
  },
  {
    id: "asana",
    name: "Asana",
    description: "Manage projects, tasks, and teams in your Asana workspace.",
    icon: "asana",
    category: "Project Management",
    authType: "oauth" as const,
    authUrl: "https://app.asana.com/-/oauth_authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-asana",
    status: "available" as const,
    tools: [
      "list_tasks", "create_task", "update_task",
      "list_projects", "create_project", "add_comment",
    ],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create and manage issues, search with JQL, and track sprints in Atlassian Jira.",
    icon: "jira",
    category: "Project Management",
    authType: "oauth" as const,
    authUrl: "https://auth.atlassian.com/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-jira",
    status: "available" as const,
    tools: [
      "search_issues", "create_issue", "update_issue",
      "add_comment", "list_sprints", "transition_issue",
    ],
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Read, create, and search pages and spaces in Atlassian Confluence.",
    icon: "confluence",
    category: "Project Management",
    authType: "oauth" as const,
    authUrl: "https://auth.atlassian.com/authorize",
    mcpEndpoint: "npx -y @modelcontextprotocol/server-confluence",
    status: "available" as const,
    tools: [
      "search_content", "get_page", "create_page",
      "update_page", "list_spaces", "get_page_children",
    ],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    description: "Search and retrieve articles, summaries, and structured data from Wikipedia.",
    icon: "wikipedia",
    category: "Search",
    authType: "none" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-wikipedia",
    status: "available" as const,
    tools: [
      "search_articles", "get_article", "get_summary",
      "get_sections", "get_links", "get_categories",
    ],
  },
  {
    id: "context7",
    name: "Context7",
    description: "Retrieve up-to-date library documentation and code examples for any programming library.",
    icon: "context7",
    category: "AI",
    authType: "none" as const,
    mcpEndpoint: "npx -y @upstash/context7-mcp",
    status: "available" as const,
    tools: [
      "resolve_library_id", "get_library_docs",
    ],
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Trigger workflows, manage executions, and list available nodes in your n8n instance.",
    icon: "n8n",
    category: "Automation",
    authType: "api_key" as const,
    mcpEndpoint: "npx -y @modelcontextprotocol/server-n8n",
    status: "available" as const,
    tools: [
      "trigger_workflow", "list_workflows", "get_execution",
      "list_executions", "activate_workflow", "deactivate_workflow",
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
