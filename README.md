# Maestro Agentica

A full-featured AI agent management platform built with Next.js. Design, build, test, deploy, and monitor intelligent agents powered by Anthropic's Claude — all from one interface.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![Claude API](https://img.shields.io/badge/Claude-Opus%20%7C%20Sonnet%20%7C%20Haiku-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## What Is This?

Maestro Agentica is a local-first platform for creating and managing AI agents. Instead of writing boilerplate API code for every agent, you configure agents visually — pick a model, attach tools, assign skills, connect memory, write a system prompt — and test everything in a built-in playground with real tool execution.

### Key Capabilities

- **Agent Builder** — Describe what you want in plain English; the AI generates the full agent configuration (model, tools, skills, system prompt)
- **Playground** — Chat with your agents in real time with streaming responses and live tool execution (filesystem, memory, web search)
- **Tools** — Connect MCP servers (GitHub, Slack, PostgreSQL, Brave Search, etc.) or use built-in filesystem and memory tools
- **Skills** — Pre-built skill templates (Code Review, Security Auditor, SQL Expert, etc.) injected into agent system prompts
- **Memory** — File-based vector memory collections; upload documents (PDF, DOCX, XLSX), and agents can search them with term-overlap scoring
- **Versioning** — Semantic versioning for every agent configuration change
- **Deployments** — Deploy agents to dev, staging, and production environments
- **Metrics & Logs** — Track response times, token usage, costs, success rates, and structured logs per agent
- **Import/Export** — Package agents as ZIP files with full configurations for sharing or backup
- **Diagnostics** — Built-in system health checks and interactive tool tester

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.4 |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Database | SQLite via Prisma ORM |
| Vector Store | File-based local storage (JSON) |
| UI | React 18, Tailwind CSS, Radix UI (shadcn/ui) |
| Charts | Recharts |
| State | Zustand |
| File Parsing | pdf-parse, mammoth, xlsx |

## Prerequisites

- **Node.js** 18.17 or later
- **npm** or **yarn** or **pnpm**
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/nakya/MaestroAgentica.git
cd MaestroAgentica
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL="file:./dev.db"

# Optional — can also be set in the Settings page
ANTHROPIC_API_KEY="sk-ant-..."

# Optional — directory for file-based memory storage (defaults to ./vectordb)
VECTOR_DB_PATH="./vectordb"
```

### 4. Initialize the database

```bash
npx prisma generate
npx prisma db push
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Configure your API key

If you didn't set `ANTHROPIC_API_KEY` in `.env.local`, navigate to **Settings** in the sidebar and enter your key there.

## Project Structure

```
MaestroAgentica/
├── prisma/
│   └── schema.prisma          # Database schema (SQLite)
├── src/
│   ├── app/                   # Next.js App Router pages & API routes
│   │   ├── page.tsx           # Dashboard
│   │   ├── agent-builder/     # AI-powered agent creation
│   │   ├── agents/            # Agent CRUD, playground, versions, deployments, metrics, logs
│   │   ├── memory/            # ChromaDB memory collections
│   │   ├── tools/             # MCP connector management
│   │   ├── skills/            # Skills catalog and custom skills
│   │   ├── marketplace/       # Import/export agents
│   │   ├── diagnostics/       # System health checks
│   │   ├── settings/          # Global configuration
│   │   └── api/               # All API routes
│   ├── components/            # React components (layout, dashboard, playground, ui)
│   ├── lib/                   # Core libraries (db, chromadb, tool-executor, serializer, etc.)
│   ├── stores/                # Zustand state stores
│   └── types/                 # TypeScript type definitions
├── agent-sandbox/             # Sandboxed filesystem for agent tool execution
├── package.json
└── tailwind.config.js
```

## Vector Storage (Memory)

The **Memory** feature uses a lightweight, file-based vector store — no external database or server required.

- **Storage:** Collections are stored as JSON files under `./vectordb/` (or your configured `VECTOR_DB_PATH`)
- **Search:** Queries use term-overlap scoring — documents are scored based on how many query terms they contain
- **Persistence:** All data persists across restarts automatically
- **Supported formats:** PDF, DOCX, XLSX, XLS, TXT, MD, JSON, CSV, HTML, and more

Each collection is a self-contained JSON file with the structure:
```json
{
  "name": "my-collection",
  "metadata": { "description": "..." },
  "documents": [
    { "id": "...", "text": "...", "metadata": { "fileName": "..." } }
  ]
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
