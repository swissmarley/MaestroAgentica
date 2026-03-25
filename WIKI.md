# Maestro Agentica — Wiki

A comprehensive guide to every feature, page, and operation available in Maestro Agentica.

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Agent Builder](#2-agent-builder)
3. [Agents](#3-agents)
   - [Creating an Agent](#31-creating-an-agent)
   - [Agent Detail Page](#32-agent-detail-page)
   - [Playground (per-agent)](#33-playground)
   - [Versions](#34-versions)
   - [Deployments](#35-deployments)
   - [Metrics](#36-metrics)
   - [Logs](#37-logs)
4. [Chat Playground](#4-chat-playground)
5. [Memory](#5-memory)
6. [Tools](#6-tools)
7. [Skills](#7-skills)
8. [Marketplace (Import/Export)](#8-marketplace-importexport)
9. [Diagnostics](#9-diagnostics)
10. [Settings](#10-settings)
11. [CLI (Command-Line Interface)](#11-cli-command-line-interface)
12. [API Reference](#12-api-reference)
13. [Architecture](#13-architecture)
14. [Data Models](#14-data-models)
15. [Changelog](#15-changelog)

---

## 1. Dashboard

**Route:** `/`

The dashboard provides a real-time overview of your entire agent fleet.

### What You See

- **Total Agents** — Count of all agents in the system
- **Active Agents** — Agents with status `active`
- **Total Runs** — Sum of all playground and deployment test executions
- **Total Cost** — Cumulative API cost in USD across all agents
- **Total Tokens** — Combined input + output token usage
- **Success Rate** — Percentage of successful executions
- **Average Response Time** — Mean response time across all runs
- **Usage Chart** — 14-day trend line of daily token usage (input vs. output)
- **Activity Feed** — Recent agent events (creation, updates, deployments)
- **Agent Status Grid** — Visual grid of all agents with their current status

### How It Works

The dashboard fetches data from `/api/dashboard/stats`, which aggregates `PerformanceMetric` records over the last 14 days and returns both summary statistics and a daily timeline.

---

## 2. Agent Builder

**Route:** `/agent-builder`

The Agent Builder is a conversational AI-powered agent creation flow. Instead of manually configuring every field, you describe what you want in plain English, and the AI generates the full configuration.

### How to Use

1. **Describe your agent** — Type a natural-language description of the agent you want. For example: *"A code review assistant that checks PRs for bugs, security issues, and style"*
2. **Answer follow-ups** — If the AI needs more context, it will ask 1-2 clarifying questions
3. **Review the preview** — Once the AI has enough information, it generates a complete configuration and shows a preview screen with:
   - Agent name, description, and icon
   - Selected model (Sonnet, Opus, or Haiku)
   - Generated system prompt
   - Recommended tools and skills
   - Temperature, max turns, and other settings
4. **Edit if needed** — You can modify any field in the preview before confirming
5. **Regenerate** — Click "Regenerate" to get a different configuration
6. **Confirm & Create** — Creates the agent with all tools and skills properly saved

### Starter Prompts

The builder offers four starter prompts to get you going quickly:
- Customer support agent for billing and refunds
- Code review assistant for PRs
- Research agent with web search
- DevOps agent for deployment monitoring

### What Gets Saved

When you confirm creation, the builder:
1. Fetches full skill content from the skills catalog (not just IDs)
2. Fetches tool metadata from the tools catalog
3. Creates the agent with a complete version definition
4. Attaches each selected tool in the `AgentTool` database table
5. Attaches each selected skill in the `AgentSkill` database table

---

## 3. Agents

**Route:** `/agents`

The agents list page shows all agents with search, status filtering, and bulk operations.

### Operations

| Action | Description |
|--------|-------------|
| **Search** | Filter agents by name |
| **Filter by status** | Show only draft, active, paused, or archived agents |
| **Create Agent** | Navigate to `/agents/new` to create manually, or use Agent Builder |
| **Edit** | Click an agent to go to its detail page |
| **Duplicate** | Create a copy of an existing agent |
| **Delete** | Permanently remove an agent and all its versions, deployments, metrics, and logs |

### Agent Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Initial state; agent is being configured |
| `active` | Agent is live and ready for use |
| `paused` | Temporarily disabled |
| `archived` | Soft-deleted, kept for reference |

---

### 3.1 Creating an Agent

**Route:** `/agents/new`

Manual agent creation form with fields for:

- **Name** — Display name for the agent
- **Description** — What the agent does
- **System Prompt** — The core instructions the agent follows
- **Model** — Claude model to use:
  - `claude-sonnet-4-6` — Fast, balanced (recommended for most use cases)
  - `claude-opus-4-6` — Most capable, best for complex reasoning
  - `claude-haiku-4-5-20251001` — Fastest, most cost-efficient
- **Temperature** — 0.0 (deterministic) to 1.0 (creative)
- **Max Turns** — How many tool-use loops the agent can perform (1-25)
- **Web Search** — Toggle Claude's built-in web search capability

---

### 3.2 Agent Detail Page

**Route:** `/agents/[id]`

The main configuration editor for an existing agent. Includes sub-navigation tabs:

| Tab | Route | Purpose |
|-----|-------|---------|
| Overview | `/agents/[id]` | Edit name, description, system prompt, model, parameters |
| Playground | `/agents/[id]/playground` | Test the agent interactively |
| Versions | `/agents/[id]/versions` | View and manage version history |
| Deployments | `/agents/[id]/deployments` | Deploy to environments |
| Metrics | `/agents/[id]/metrics` | Performance analytics |
| Logs | `/agents/[id]/logs` | Structured log viewer |

---

### 3.3 Playground

**Route:** `/agents/[id]/playground`

An interactive chat interface for testing your agent with real tool execution.

### Features

- **Streaming responses** — See the agent's response token by token via Server-Sent Events
- **Real tool execution** — Tools are actually executed, not simulated:
  - **Filesystem tools** — `read_file`, `write_file`, `list_directory`, `create_directory`, `move_file`, `search_files` (sandboxed to `agent-sandbox/` directory)
  - **Memory tools** — `memory_query` (semantic search in ChromaDB), `memory_store` (add to collections), `memory_list_collections`
  - **Web search** — Claude's built-in web search (server-managed)
- **Tool call visualization** — See each tool invocation with its input parameters and output
- **Multi-turn conversations** — The agent can use tools, get results, and continue reasoning up to `maxTurns`
- **Token tracking** — Input/output token counts displayed per message
- **Skill injection** — All attached skills are injected into the system prompt
- **Memory context** — Attached memory collections are listed in the system prompt with IDs so the agent can query them

### How Tool Execution Works

1. The agent receives the user's message plus tool definitions
2. If the agent decides to use a tool, it returns a `tool_use` content block
3. The server executes the tool via `tool-executor.ts` (real filesystem/memory operations)
4. The tool result is sent back to the agent as a `tool_result`
5. The agent can then respond based on the real result, or use another tool
6. This loop continues up to `maxTurns`

### Sandbox

All filesystem operations are restricted to the `agent-sandbox/` directory at the project root. Path traversal attempts are blocked. This means when an agent writes a file, it goes to `agent-sandbox/your-path`, not your actual filesystem.

---

### 3.4 Versions

**Route:** `/agents/[id]/versions`

Every time you save changes to an agent's configuration, a new version is created.

- **Semantic versioning** — Versions follow `v0.1.0`, `v0.2.0`, `v1.0.0` pattern
- **Version tree** — Each version links to its parent via `parentId`
- **Changelog** — Optional description of what changed
- **Immutable** — Once created, a version cannot be modified
- **Rollback** — Select any previous version to make it the active configuration

---

### 3.5 Deployments

**Route:** `/agents/[id]/deployments`

Deploy agents to different environments.

| Environment | Purpose |
|-------------|---------|
| `dev` | Development testing |
| `staging` | Pre-production validation |
| `prod` | Live production use |

### Operations

- **Deploy** — Create or update a deployment for a specific environment; links to the latest version
- **Stop** — Stop a running deployment
- **Status tracking** — `pending` → `running` → `stopped`
- **One per environment** — Each agent can have at most one deployment per environment

---

### 3.6 Metrics

**Route:** `/agents/[id]/metrics`

Performance analytics for an individual agent.

### Available Metrics

| Metric | Description |
|--------|-------------|
| Total Runs | Number of test/deployment executions |
| Avg Response Time | Mean response time in milliseconds |
| Total Input Tokens | Sum of all input tokens consumed |
| Total Output Tokens | Sum of all output tokens generated |
| Total Cost | Estimated API cost in USD |
| Success Rate | Percentage of runs that completed without error |

### Time Periods

Filter metrics by: **Last 1 hour**, **Last 24 hours**, **Last 7 days**, **Last 30 days**

### Timeline Chart

Hourly aggregated data showing token usage over the selected period.

### Cost Calculation

Costs are estimated per model:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude Sonnet 4.6 | $3 | $15 |
| Claude Opus 4.6 | $15 | $75 |
| Claude Haiku 4.5 | $0.80 | $4 |

---

### 3.7 Logs

**Route:** `/agents/[id]/logs`

Structured logging system for monitoring agent behavior.

### Log Levels

| Level | Color | Use |
|-------|-------|-----|
| `debug` | Gray | Detailed execution trace |
| `info` | Blue | Normal operations |
| `warn` | Yellow | Non-critical issues |
| `error` | Red | Failures and exceptions |

### Features

- **Search** — Full-text search across log messages
- **Level filter** — Show only specific log levels
- **Pagination** — Browse large log volumes efficiently
- **Metadata** — Each log entry can carry arbitrary JSON metadata
- **Timestamps** — Precise timestamps for every entry

---

## 4. Chat Playground

**Route:** `/playground`

A dedicated, full-page chat interface for testing any agent with real tool execution, file attachments, and full conversation memory.

### Layout

- **Sidebar** — Agent selection dropdown, channel selector (Development / Staging / Production), session info, and New Chat button
- **Chat Area** — Message thread with rich rendering, input bar at the bottom with file attachment support

### Features

| Feature | Description |
|---------|-------------|
| **Agent Selection** | Dropdown lists all agents in the system. Select one to start chatting. |
| **Channel Selection** | Choose between Development, Staging, or Production environments. |
| **Conversation Memory** | Full message history is sent with every request. The agent retains context across the entire session. |
| **File Attachments** | Attach images, PDFs, Excel, TXT, and other files via drag-and-drop or the clip icon. Image previews are shown inline. |
| **Rich Rendering** | Agent responses render markdown: code blocks with syntax labels, bold, italic, and inline code. |
| **Streaming Responses** | Responses appear token-by-token via Server-Sent Events. |
| **Tool Usage Indicators** | When the agent invokes tools, expandable cards show the tool name, input, output, and status (running/completed/error) with timing. |
| **Skill Usage Indicators** | When the agent has active skills, amber badges display each skill name on assistant messages (e.g., "Documentation Writer"). |
| **Copy Messages** | Hover over any message to reveal a copy button. |
| **Token Tracking** | Output token count displayed per assistant message. |
| **New Chat** | Clears conversation history and starts a fresh session. |

### How Conversation Memory Works

1. All prior user and assistant messages are collected from the current session
2. They are sent as the `history` array in the API request body
3. The backend prepends the full history to the Anthropic API `messages` array
4. The agent sees the complete conversation context on every turn

Memory is scoped per session — starting a "New Chat" resets it completely.

### How Skill Indicators Work

1. When a message is sent, the backend checks for enabled skills in the agent definition
2. A `skills_active` SSE event is emitted at the start of the stream with the list of active skill names
3. The frontend displays amber badges on the assistant message showing which skills are active
4. Skills are injected into the system prompt, not called as tools — the badges indicate which specialized instructions are influencing the agent's behavior

### How Tool Indicators Work

1. When the agent decides to use a tool, a `tool_use_start` SSE event is emitted
2. The frontend shows an expandable card with a spinning indicator and the tool name
3. When the tool completes, a `tool_result` event updates the card with output and duration
4. Cards can be expanded to inspect the full input JSON and output text
5. On stream completion, any still-running tools are automatically marked as completed

---

## 5. Memory

**Route:** `/memory`

ChromaDB-powered vector memory system that gives agents access to custom knowledge bases.

### Concepts

- **Collection** — A named container for documents in ChromaDB. Each collection has a unique `chromaId` used for vector operations.
- **Document** — A file uploaded into a collection. Automatically chunked and embedded for semantic search.
- **Agent-Memory Link** — A many-to-many relationship connecting agents to collections they can query.

### Operations

#### Create a Collection
1. Click "New Collection"
2. Enter a name and description
3. The system creates a matching ChromaDB collection

#### Upload Documents
1. Open a collection
2. Click "Upload"
3. Select files — supported formats:
   - **Text:** `.txt`, `.md`, `.json`, `.csv`, `.html`, `.xml`, `.yaml`, `.rtf`
   - **Documents:** `.pdf`, `.docx`
   - **Spreadsheets:** `.xlsx`, `.xls`
4. The system automatically:
   - Parses the file content (using pdf-parse, mammoth, or xlsx libraries)
   - Splits text into chunks (sentence-aware, ~1000 chars with 200 char overlap)
   - Embeds chunks into ChromaDB

#### Link to Agent
1. Open a collection
2. Use the "Attach Agent" dropdown to link it to an agent
3. When the agent runs in the playground, its system prompt will include the collection ID and name
4. The agent can then use `memory_query` to search and `memory_store` to add entries

### How Agents Use Memory

When an agent has linked memory collections, the playground injects:
1. A list of available collections (name, ID, description) into the system prompt
2. The `memory_query`, `memory_store`, and `memory_list_collections` tools into the tool list

The agent can then:
- Search for relevant information: `memory_query({ query: "deployment process", collection_id: "abc123" })`
- Store new information: `memory_store({ collection_id: "abc123", content: "New deployment step...", metadata: { source: "user" } })`
- List what's available: `memory_list_collections({})`

---

## 6. Tools

**Route:** `/tools`

Manage MCP (Model Context Protocol) server connections and tool configurations. The Tools page provides a unified interface for connecting 33 pre-built integrations across development, communication, productivity, data, and more.

### Available Connectors (33 total)

#### Development

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **GitHub** | OAuth 2.0 | `search_repositories`, `get_file_contents`, `create_issue`, `list_pull_requests`, `create_pull_request`, `get_commit_history` | Access repositories, issues, PRs, and code search via GitHub's API |

#### Communication

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Slack** | OAuth 2.0 | `send_message`, `search_messages`, `list_channels`, `get_channel_history`, `add_reaction` | Send messages, search conversations, and manage channels |
| **Outlook** | OAuth 2.0 | `send_email`, `read_inbox`, `search_emails`, `list_calendar_events`, `create_calendar_event`, `list_contacts` | Read/send emails, manage calendar, and access contacts via Microsoft Outlook |
| **Gmail** | OAuth 2.0 | `send_email`, `read_inbox`, `search_emails`, `get_thread`, `create_label`, `modify_labels` | Read, send, and manage emails with full label and thread support |
| **Discord** | API Key | `send_message`, `read_messages`, `list_channels`, `list_guild_members`, `create_channel`, `add_reaction` | Send messages, manage channels, and interact with Discord servers |
| **Telegram** | API Key | `send_message`, `get_updates`, `send_photo`, `get_chat`, `set_webhook`, `edit_message` | Send/receive messages, manage groups, and handle media via Telegram Bot API |

#### Productivity

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Google Drive** | OAuth 2.0 | `search_files`, `read_file`, `list_files` | Access and manage files including docs, sheets, and slides |
| **Google Calendar** | OAuth 2.0 | `list_events`, `create_event`, `update_event`, `delete_event`, `list_calendars`, `find_free_time` | Create, read, and manage events across Google Calendar accounts |
| **OneDrive** | OAuth 2.0 | `list_files`, `upload_file`, `download_file`, `search_files`, `create_folder`, `share_file` | Access, upload, and manage files in Microsoft OneDrive |
| **Notion** | OAuth 2.0 | `search_pages`, `read_page`, `create_page`, `update_page`, `query_database`, `create_database` | Read, create, and update pages, databases, and blocks in Notion |
| **Airtable** | API Key | `list_records`, `create_record`, `update_record`, `delete_record`, `list_bases`, `list_tables` | Read, create, and update records in Airtable bases |

#### CRM

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **HubSpot** | OAuth 2.0 | `list_contacts`, `create_contact`, `update_contact`, `list_deals`, `create_deal`, `search_crm` | Manage contacts, deals, companies, and pipelines |
| **Salesforce** | OAuth 2.0 | `query_soql`, `create_record`, `update_record`, `delete_record`, `describe_object`, `search_sosl` | Query records, manage objects, and automate workflows |

#### Data

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **PostgreSQL** | Connection String | `query`, `list_tables`, `describe_table`, `insert_row`, `update_rows` | Query and manage PostgreSQL databases |
| **Supabase** | API Key | `query_table`, `insert_rows`, `update_rows`, `delete_rows`, `upload_file`, `invoke_function` | Query tables, manage storage, and invoke edge functions |
| **MongoDB** | Connection String | `find_documents`, `insert_document`, `update_document`, `delete_document`, `aggregate`, `list_collections` | Query, insert, update, and aggregate documents |
| **MySQL** | Connection String | `query`, `list_tables`, `describe_table`, `insert_row`, `update_rows`, `execute_sql` | Execute queries, manage tables, and perform operations |

#### Design

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Figma** | OAuth 2.0 | `get_file`, `get_components`, `get_styles`, `get_comments`, `export_nodes`, `list_projects` | Access design files, components, and styles from Figma |
| **Canva** | OAuth 2.0 | `create_design`, `list_templates`, `export_design`, `upload_asset`, `list_folders`, `share_design` | Create designs, manage templates, and export assets |

#### Finance

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Stripe** | API Key | `list_customers`, `create_payment_intent`, `list_subscriptions`, `create_invoice`, `get_balance`, `list_charges` | Manage payments, customers, subscriptions, and invoices |
| **PayPal** | OAuth 2.0 | `create_order`, `capture_payment`, `list_transactions`, `create_payout`, `get_balance`, `issue_refund` | Process payments, manage orders, and handle payouts |

#### Project Management

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Asana** | OAuth 2.0 | `list_tasks`, `create_task`, `update_task`, `list_projects`, `create_project`, `add_comment` | Manage projects, tasks, and teams |
| **Jira** | OAuth 2.0 | `search_issues`, `create_issue`, `update_issue`, `add_comment`, `list_sprints`, `transition_issue` | Create/manage issues, search with JQL, track sprints |
| **Confluence** | OAuth 2.0 | `search_content`, `get_page`, `create_page`, `update_page`, `list_spaces`, `get_page_children` | Read, create, and search pages and spaces |

#### Search

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Brave Search** | API Key | `brave_web_search`, `brave_local_search` | Web search for real-time information retrieval |
| **Wikipedia** | None | `search_articles`, `get_article`, `get_summary`, `get_sections`, `get_links`, `get_categories` | Search and retrieve articles, summaries, and structured data |

#### Automation

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Puppeteer** | None | `navigate`, `screenshot`, `click`, `fill`, `evaluate` | Browser automation for web scraping and testing |
| **Zapier** | API Key | `list_actions`, `execute_action`, `get_action_status`, `list_zaps`, `enable_zap`, `disable_zap` | Trigger Zaps, list actions, and manage automations |
| **n8n** | API Key | `trigger_workflow`, `list_workflows`, `get_execution`, `list_executions`, `activate_workflow`, `deactivate_workflow` | Trigger workflows, manage executions in your n8n instance |

#### Infrastructure

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Cloudflare** | API Key | `list_zones`, `create_dns_record`, `list_workers`, `deploy_worker`, `kv_read`, `kv_write` | Manage DNS records, Workers, KV namespaces, and security settings |

#### AI

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Memory** | None | `create_entities`, `create_relations`, `search_nodes`, `read_graph`, `delete_entities` | Persistent knowledge graph memory for context across conversations |
| **Context7** | None | `resolve_library_id`, `get_library_docs` | Retrieve up-to-date library documentation and code examples |

#### System

| Connector | Auth Type | Tools | Description |
|-----------|-----------|-------|-------------|
| **Filesystem** | None | `read_file`, `write_file`, `list_directory`, `create_directory`, `move_file`, `search_files` | Read, write, and manage local files with configurable access controls |

### Authentication Types

| Type | Flow | Connectors |
|------|------|------------|
| **OAuth 2.0** | Opens a branded authorization popup where the user reviews requested permissions and clicks Authorize. Connection is only saved on explicit approval. | GitHub, Slack, Outlook, OneDrive, Gmail, Google Calendar, Google Drive, Notion, HubSpot, Salesforce, Figma, Canva, PayPal, Asana, Jira, Confluence |
| **API Key** | User enters an API key/token in a dialog and clicks Connect. | Brave Search, Discord, Telegram, Airtable, Supabase, Stripe, Zapier, Cloudflare, n8n |
| **Connection String** | User enters a database connection string. | PostgreSQL, MongoDB, MySQL |
| **None** | No credentials required — connects instantly. | Filesystem, Memory, Puppeteer, Wikipedia, Context7 |

### OAuth Authorization Flow

OAuth connectors use a real popup-based OAuth 2.0 authorization code flow:

1. User clicks **Connect** on an OAuth connector
2. A popup opens showing the `/tools/oauth` authorization page, branded with the provider's color scheme, icon, and name
3. The page displays:
   - **Redirect URI** — The callback URL to register in the provider's OAuth app settings (with copy button)
   - **Client ID** field — Required to start the flow
   - **Client Secret** field — Required for the token exchange step
   - **Requested permissions** — Provider-specific scopes (e.g., "Read & send emails", "Manage calendar events")
   - **Setup guide link** — Links to the provider's OAuth app documentation
4. User enters their OAuth app credentials and clicks **Authorize**
5. The browser redirects to the real provider authorization URL (e.g., `https://github.com/login/oauth/authorize`) with proper `client_id`, `redirect_uri`, `response_type=code`, `state`, and `scope` parameters
6. After the user grants access at the provider, the callback (`/tools/oauth/callback`) receives the authorization code
7. The callback extracts the connector ID from the `state` parameter and calls `/api/tools/oauth/token` to exchange the code for access/refresh tokens
8. On success, the callback sends a `postMessage` with the token data to the parent window, which persists the connection
9. On Deny: the popup sends a failure message and closes — no connection is saved
10. If the user closes the popup without completing, the pending state is cleared

Each provider has its own specific configuration (authorization URL, token URL, scopes, and provider-specific parameters like `access_type=offline` for Google or `audience=api.atlassian.com` for Atlassian).

The connection is **only** marked as connected when the popup sends a `success: true` message with valid token data — closing the popup or denying access does not create a connection.

### Operations

- **Connect** — Configure credentials for a connector (OAuth popup, API key dialog, or instant for no-auth)
- **Disconnect** — Remove credentials and revoke access
- **Assign to Agent** — Link a connected tool to an agent from the agent's configuration page
- **Custom Tools** — Create custom tool definitions with name, description, and JSON Schema input

### Built-in Executable Tools

These tools execute directly in the playground without needing an MCP server:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents from sandbox |
| `write_file` | Write content to a file |
| `list_directory` | List directory contents |
| `create_directory` | Create directories |
| `move_file` | Move or rename files |
| `search_files` | Find files by name pattern |
| `memory_query` | Semantic search in ChromaDB |
| `memory_store` | Store content in ChromaDB |
| `memory_list_collections` | List available memory collections |

---

## 7. Skills

**Route:** `/skills`

Skills are pre-written instruction sets injected into an agent's system prompt to give it specialized expertise.

### Pre-built Skills

| Skill | Description |
|-------|-------------|
| **Code Review** | Thorough code review focusing on bugs, security vulnerabilities, performance, and best practices |
| **API Designer** | Design RESTful APIs with proper patterns, HTTP methods, status codes, and validation |
| **Test Writer** | Write comprehensive test suites using AAA pattern with edge cases and naming conventions |
| **Documentation Writer** | Write clear technical documentation with structure, quick start guides, and API reference |
| **SQL Expert** | Write optimized SQL queries with performance tuning, indexing, and parameterized queries |
| **Security Auditor** | Audit code for OWASP Top 10 vulnerabilities with detailed checklist |
| **Refactoring Guide** | Apply refactoring patterns: extract methods, remove duplication, simplify conditionals |
| **Prompt Engineer** | Design effective prompts and system instructions for AI agents |

### Operations

- **Browse** — View all available skills with descriptions and categories
- **Assign** — Attach a skill to an agent (the skill's full content is injected into the system prompt)
- **Create Custom** — Write your own skill with a name, description, and content (supports markdown)
- **Generate** — Use the AI-powered skill generator to create a skill from a description

### Skill Format

Skills use YAML frontmatter:

```markdown
---
name: Skill Name
description: What this skill does
---

## Instructions

Your skill instructions here...
```

---

## 8. Marketplace (Import/Export)

**Route:** `/marketplace`

Share and reuse agents across projects.

### Export

1. Go to the Marketplace page
2. Select an agent from the dropdown
3. Click "Export"
4. Downloads a ZIP file containing:
   - `manifest.json` — Metadata, version, tags, tool/skill/memory references
   - `agent-definition.json` — Full configuration snapshot
   - `package.json` — Node.js package info
   - `src/index.ts` — Sample TypeScript code showing how to use the agent
   - `README.md` — Auto-generated documentation

### Import

1. Go to the Marketplace page
2. Click "Import"
3. Upload a ZIP or JSON file
4. The system restores:
   - The agent with all configuration
   - Tool attachments (by tool ID)
   - Skill attachments (by skill ID)
   - Memory collection links (if collections exist)
5. Redirects to the imported agent's detail page

---

## 9. Diagnostics

**Route:** `/diagnostics`

System health checks and interactive tool testing.

### Automated Checks (12 total)

| Check | What It Tests |
|-------|---------------|
| Anthropic API Key | API key is configured and accessible |
| Database Connection | SQLite database is reachable |
| Filesystem Tools (write) | Can write files to sandbox |
| Filesystem Tools (read) | Can read files from sandbox |
| Filesystem Tools (list) | Can list directory contents |
| Memory - List Collections | ChromaDB is reachable and collections exist |
| Memory - DB Records | Memory collections and agent links in database |
| Skills - Catalog | Skills API returns skills |
| Skills - Attachments | Skills are properly attached to agents |
| Tools - Built-in Definitions | Built-in tool definitions are registered |
| Tools - Attachments | Tools are properly attached to agents |
| Agent Integration | Sample agent has complete configuration |

### Check Statuses

| Status | Meaning |
|--------|---------|
| Pass | Everything works correctly |
| Fail | Something is broken and needs fixing |
| Warning | Works but may have issues |
| Skipped | Not applicable (e.g., no agents exist) |

### Tool Tester

The interactive Tool Tester lets you execute any built-in tool directly:

1. Select a tool from the dropdown
2. Enter JSON input (pre-filled with example values)
3. Click "Execute Tool"
4. See the result (success or error) with full output

This is useful for verifying that filesystem operations, memory queries, and other tools work correctly before using them in an agent.

---

## 10. Settings

**Route:** `/settings`

Global configuration for the platform.

### Available Settings

| Setting | Description |
|---------|-------------|
| **Anthropic API Key** | Your Claude API key (stored encrypted in the database, masked in UI) |
| **Default Model** | Default model for new agents |
| **Theme** | Light or dark mode |
| **Connected Tools** | Tool connection status and credentials |
| **Activated Skills** | Which skills are available globally |

### API Key Test

Click "Test" after entering your API key to verify it works before saving.

---

## 11. CLI (Command-Line Interface)

The MaestroAgentica CLI provides a terminal-based interface for interacting with agents directly from the command line.

### Installation & Launch

```bash
# Run directly from the project
node cli/maestro.mjs

# With options
node cli/maestro.mjs --url http://localhost:3000 --env development
```

### Command-Line Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Base URL of the MaestroAgentica server | `http://localhost:3000` |
| `--agent <name>` | Connect directly to a named agent (skip selection menu) | — |
| `--env <env>` | Environment: `development`, `staging`, `production` | `development` |
| `--key <key>` | API key for authentication | — |
| `--help` | Show help and exit | — |

### Interactive Commands

Once connected, use these commands at any time by typing them in the chat:

| Command | Description |
|---------|-------------|
| `/agents` | List all available agents |
| `/select <name>` | Switch to a different agent (supports fuzzy matching) |
| `/new` | Start a new conversation (clears history) |
| `/history` | Show the current conversation history |
| `/conversations` | Info about viewing past conversations |
| `/load <id>` | Info about loading past conversations |
| `/clear` | Clear the terminal display |
| `/exit` | Exit the CLI |
| `/help` | Show available commands |

### Features

- **Streaming Responses** — Agent responses are streamed token-by-token via SSE
- **Tool Visualization** — Tool invocations are displayed inline with status indicators (`⚡ Using tool: <name> [done]` or `[error]`)
- **Conversation Memory** — Full message history is passed on every turn, maintaining context throughout the session
- **Multi-line Input** — End a line with `\` to continue on the next line
- **Token Tracking** — Input/output token counts are shown after each response
- **Config Persistence** — Connection settings (`--url`, `--key`, `--env`) are saved to `~/.maestro/config.json` for reuse
- **Agent Fuzzy Matching** — Both `/select` and `--agent` support partial name matching

### Example Session

```
  ╔══════════════════════════════════════╗
  ║       MaestroAgentica CLI v0.1       ║
  ╚══════════════════════════════════════╝

  Server: http://localhost:3000
  Environment: development

Available Agents:
──────────────────────────────────────────────────
  ► 1. CodeAssistant (a3f2b1c8...) [active]
       A helpful coding assistant with filesystem tools

Select an agent (number or name): 1
Connected to CodeAssistant

You (CodeAssistant): List the files in the current directory

CodeAssistant:
  ⚡ Using tool: list_directory [done]

Here are the files in the agent sandbox:
- README.md
- src/
- package.json

  [245 input / 38 output tokens]
```

---

## 12. API Reference

### Agent Endpoints

```
GET    /api/agents                    # List agents (query: search, status)
POST   /api/agents                    # Create agent
GET    /api/agents/[id]               # Get agent with relations
PUT    /api/agents/[id]               # Update agent
DELETE /api/agents/[id]               # Delete agent
```

### Version Endpoints

```
GET    /api/agents/[id]/versions      # List versions
POST   /api/agents/[id]/versions      # Create version
```

### Testing & Execution

```
POST   /api/agents/[id]/test          # Stream test (SSE) — real tool execution
```

### Deployment Endpoints

```
GET    /api/agents/[id]/deploy        # List deployments
POST   /api/agents/[id]/deploy        # Deploy to environment
DELETE /api/agents/[id]/deploy        # Stop deployment (query: environment)
```

### Metrics & Logs

```
GET    /api/agents/[id]/metrics       # Get metrics (query: period)
GET    /api/agents/[id]/logs          # Get logs (query: level, search, page, limit)
```

### Tool & Skill Assignment

```
POST   /api/agents/[id]/tools         # Attach tool (body: { toolId })
DELETE /api/agents/[id]/tools         # Detach tool (query: toolId)
POST   /api/agents/[id]/skills        # Attach skill (body: { skillId })
DELETE /api/agents/[id]/skills        # Detach skill (query: skillId)
```

### Memory

```
GET    /api/memory                     # List collections
POST   /api/memory                     # Create collection
GET    /api/memory/[id]                # Get collection
PUT    /api/memory/[id]                # Update collection / attach-detach agents
DELETE /api/memory/[id]                # Delete collection
POST   /api/memory/[id]/documents      # Upload document
```

### Tools & Skills Catalog

```
GET    /api/tools                      # List MCP connectors
POST   /api/tools                      # Create custom tool
GET    /api/skills                     # List skills
POST   /api/skills                     # Create custom skill
```

### Import/Export

```
GET    /api/agents/[id]/export         # Export agent as ZIP
POST   /api/import                     # Import agent package
```

### Agent Builder

```
POST   /api/agent-builder              # Conversational builder (body: { messages })
```

### Dashboard & Settings

```
GET    /api/dashboard/stats            # Dashboard statistics
GET    /api/settings                   # Get all settings
PUT    /api/settings                   # Update a setting
POST   /api/settings/test              # Test API key
```

### Diagnostics

```
GET    /api/diagnostics                # Run all health checks
POST   /api/diagnostics                # Execute a tool (body: { toolName, input })
```

---

## 13. Architecture

### Request Flow

```
User → Next.js Page → React Component → API Route → Prisma DB / Anthropic API / ChromaDB
```

### Agent Execution Flow (Playground)

```
1. User sends message
2. API route loads agent definition + version
3. System prompt is built:
   a. Base system prompt from definition
   b. + Skill content (for each attached skill)
   c. + Memory collection listing (names + IDs)
   d. + Tool availability context
4. Tool list is built:
   a. Custom tools from definition
   b. + Built-in tools from attached tool IDs (filesystem, memory)
   c. + Web search (if enabled)
5. Anthropic API is called with streaming
6. Response is streamed as SSE events
7. If agent uses a tool:
   a. Tool input is parsed
   b. Tool is executed via tool-executor.ts (real execution)
   c. Result is sent back to agent
   d. Loop continues (up to maxTurns)
8. Performance metrics are recorded
```

### State Management

| Store | Purpose | Key State |
|-------|---------|-----------|
| `agent-store` | Global agent data | Agent list, current agent, loading states |
| `playground-store` | Chat session | Messages, tool calls, streaming state |
| `ui-store` | UI preferences | Theme, sidebar collapsed, modals |

### Database Schema

SQLite with Prisma ORM. All relations cascade on delete.

### Security

- **API Key Storage** — Keys are stored in the database, masked in UI responses
- **Filesystem Sandbox** — All agent file operations are confined to `agent-sandbox/`
- **Path Traversal Prevention** — Resolved paths are validated against sandbox root
- **Input Validation** — Zod schemas validate API inputs

---

## 14. Data Models

### Agent

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (CUID) |
| name | string | Display name |
| description | string | What the agent does |
| status | string | draft, active, paused, archived |
| icon | string? | Emoji icon |
| tags | string | JSON array of tags |

### AgentVersion

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| agentId | string | Parent agent |
| version | string | Semantic version (e.g., "v0.1.0") |
| definition | string | JSON blob with full agent configuration |
| changelog | string | What changed |
| parentId | string? | Previous version |

### StoredAgentDefinition (JSON in version.definition)

| Field | Type | Description |
|-------|------|-------------|
| model | string | Claude model ID |
| systemPrompt | string | Agent instructions |
| tools | ToolDefinition[] | Custom tool schemas |
| maxTurns | number | Max tool-use loops |
| temperature | number? | Sampling temperature |
| topP | number? | Top-p sampling |
| stopSequences | string[]? | Stop sequences |
| webSearchEnabled | boolean? | Enable web search |
| skills | AgentSkill[]? | Skill name + content |
| mcpServers | McpServer[]? | MCP server connections |

### MemoryCollection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Display name |
| description | string | What the collection contains |
| chromaId | string | ChromaDB collection name |
| totalSize | number | Total bytes uploaded |

### Deployment

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| agentId | string | Parent agent |
| versionId | string | Deployed version |
| environment | string | dev, staging, prod |
| status | string | pending, running, stopped |

### PerformanceMetric

| Field | Type | Description |
|-------|------|-------------|
| responseTime | float | Response time in ms |
| inputTokens | int | Input tokens consumed |
| outputTokens | int | Output tokens generated |
| totalCostUsd | float | Estimated cost in USD |
| success | boolean | Whether execution succeeded |
| modelUsed | string | Model ID used |
| numTurns | int | Number of tool-use turns |

---

## 15. Changelog

### v0.2.0 — Chat Playground & Bug Fixes

#### New Features

- **Dedicated Chat Playground** (`/playground`) — Full-page chat interface with agent selection, channel picker, file attachments, and streaming responses
- **Skill Usage Indicators** — Amber badges on assistant messages showing which skills are active during the conversation (e.g., "Documentation Writer", "Code Review")
- **Tool Usage Indicators** — Expandable cards showing tool name, input, output, status, and execution duration during agent conversations
- **Conversation Memory** — Full message history is passed with every request, maintaining context across the entire chat session

#### Bug Fixes

- **Agent Chat Memory** — Fixed conversation history not being passed to the agent on subsequent messages. Prior messages are now correctly sent as the `history` array on every turn.
- **Filesystem Tools Hanging** — Fixed tool execution never completing when `maxTurns` was set to 1. The minimum is now enforced at 2 turns when tools are available (one for tool invocation, one for processing results). Also fixed tools with empty input not being captured due to a falsy-check on the input JSON string.
- **Tool Spinner Never Stopping** — Added safety net that marks any remaining "running" tool calls as "completed" when the stream ends, ensuring spinners always resolve.
- **OAuth Hydration Errors** — Fixed `window.location.origin` being computed during server render, causing Next.js hydration mismatch errors on all OAuth tool pages. The redirect URI is now set via `useEffect` on the client only.
- **No Agents in Playground** — Fixed the agent dropdown showing no agents. The `/api/agents` endpoint returns an array directly, but the playground expected `data.agents`. Now handles both formats.
- **CLI Shows No Agents** — Fixed the CLI `fetchAgents()` expecting `data.agents` from the API response, but the API returns a plain array. Now handles both formats.
- **Tool Indicators Missing for Non-Filesystem Tools** — External/MCP connector tools (Wikipedia, GitHub, Slack, etc.) were not registered with Claude because `getToolDefinitionsForIds` only mapped `filesystem` and `memory`. Added a full connector tool catalog with definitions for all 33 connectors so the agent can discover and invoke any attached tool.
- **Stop Button Not Working** — The stop button in Chat Playground had no click handler. Now uses `AbortController` to abort the SSE stream, finalize the accumulated content, and resolve any running tool spinners.
