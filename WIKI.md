# Maestro Agentica — Wiki

A comprehensive guide to every feature, page, and operation available in Maestro Agentica.

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Agent Builder](#2-agent-builder)
3. [Agents](#3-agents)
   - [Creating an Agent](#31-creating-an-agent)
   - [Agent Detail Page](#32-agent-detail-page)
   - [Playground](#33-playground)
   - [Versions](#34-versions)
   - [Deployments](#35-deployments)
   - [Metrics](#36-metrics)
   - [Logs](#37-logs)
4. [Memory](#4-memory)
5. [Tools](#5-tools)
6. [Skills](#6-skills)
7. [Marketplace (Import/Export)](#7-marketplace-importexport)
8. [Diagnostics](#8-diagnostics)
9. [Settings](#9-settings)
10. [API Reference](#10-api-reference)
11. [Architecture](#11-architecture)
12. [Data Models](#12-data-models)

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

## 4. Memory

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

## 5. Tools

**Route:** `/tools`

Manage MCP (Model Context Protocol) server connections and tool configurations.

### Available Connectors

| Connector | Auth Type | Capabilities |
|-----------|-----------|-------------|
| **GitHub** | OAuth | Repositories, issues, PRs, code search |
| **Slack** | OAuth | Messages, channels, conversations |
| **Filesystem** | None | Read, write, manage local files |
| **PostgreSQL** | Connection String | Query, table management |
| **Brave Search** | API Key | Web search for real-time information |
| **Google Drive** | OAuth | File access and management |
| **Memory** | None | Knowledge graph persistence |
| **Puppeteer** | None | Browser automation, scraping, screenshots |

### Operations

- **Connect** — Configure credentials for a connector
- **Disconnect** — Remove credentials
- **Test** — Verify the connection works
- **Assign to Agent** — Link a connector to an agent
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

## 6. Skills

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

## 7. Marketplace (Import/Export)

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

## 8. Diagnostics

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

## 9. Settings

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

## 10. API Reference

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

## 11. Architecture

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

## 12. Data Models

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
