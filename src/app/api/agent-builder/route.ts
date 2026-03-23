import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/get-api-key";

export const runtime = "nodejs";

const AVAILABLE_TOOLS = [
  { id: "github", name: "GitHub", description: "Access repositories, issues, PRs, and code search", category: "Development" },
  { id: "slack", name: "Slack", description: "Send messages, search conversations, manage channels", category: "Communication" },
  { id: "filesystem", name: "Filesystem", description: "Read, write, and manage local files", category: "System" },
  { id: "postgres", name: "PostgreSQL", description: "Query and manage PostgreSQL databases", category: "Data" },
  { id: "brave-search", name: "Brave Search", description: "Web search for real-time information", category: "Search" },
  { id: "google-drive", name: "Google Drive", description: "Access Google Drive files and docs", category: "Productivity" },
  { id: "memory", name: "Memory", description: "Persistent knowledge graph for context across conversations", category: "AI" },
  { id: "puppeteer", name: "Puppeteer", description: "Browser automation, scraping, and screenshots", category: "Automation" },
];

const AVAILABLE_SKILLS = [
  { id: "code-review", name: "Code Review", description: "Thorough code review with focus on bugs, security, and best practices", category: "Development" },
  { id: "api-designer", name: "API Designer", description: "Design RESTful APIs with proper patterns and validation", category: "Development" },
  { id: "test-writer", name: "Test Writer", description: "Write comprehensive test suites with edge cases", category: "Testing" },
  { id: "docs-writer", name: "Documentation Writer", description: "Write clear technical documentation", category: "Documentation" },
  { id: "sql-expert", name: "SQL Expert", description: "Write optimized SQL queries with performance tuning", category: "Data" },
  { id: "security-auditor", name: "Security Auditor", description: "Audit code for OWASP vulnerabilities", category: "Security" },
  { id: "refactoring-guide", name: "Refactoring Guide", description: "Apply refactoring patterns to improve code quality", category: "Development" },
  { id: "prompt-engineer", name: "Prompt Engineer", description: "Design effective prompts and system instructions for AI agents", category: "AI" },
];

const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Fast, balanced performance" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Most capable, complex reasoning" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "Fastest, cost-efficient" },
];

const BUILDER_SYSTEM_PROMPT = `You are an expert AI agent architect within the Maestro Agentica platform. Your job is to help users create fully configured AI agents from natural language descriptions.

You have access to these tools that can be assigned to agents:
${JSON.stringify(AVAILABLE_TOOLS, null, 2)}

You have access to these skills that can be assigned to agents:
${JSON.stringify(AVAILABLE_SKILLS, null, 2)}

Available models:
${JSON.stringify(AVAILABLE_MODELS, null, 2)}

When the user describes what they want their agent to do, you must determine if you have enough information to generate a complete agent configuration. If you need more details, ask focused follow-up questions (maximum 1-2 at a time).

When you have enough information, respond with a JSON block wrapped in <agent-config> tags containing:

<agent-config>
{
  "name": "Agent Name",
  "description": "Brief description of what the agent does",
  "icon": "emoji icon for the agent",
  "tags": ["tag1", "tag2"],
  "definition": {
    "model": "model-id from available models",
    "systemPrompt": "Detailed system prompt with role, capabilities, constraints, and output format",
    "tools": ["tool-id-1", "tool-id-2"],
    "skills": ["skill-id-1", "skill-id-2"],
    "maxTurns": 5,
    "temperature": 0.7,
    "webSearchEnabled": false
  },
  "reasoning": "Brief explanation of why you chose these specific tools, skills, model, and settings"
}
</agent-config>

Guidelines for generating agent configs:
- Choose the most appropriate model: Opus for complex reasoning tasks, Sonnet for balanced general use, Haiku for simple/fast tasks
- Only include tools that are directly relevant to the agent's purpose
- Only include skills that enhance the agent's capabilities for its role
- Write detailed, well-structured system prompts that define the agent's role, capabilities, constraints, and output format
- Set temperature lower (0.1-0.3) for precise/factual tasks, higher (0.7-1.0) for creative tasks
- Set maxTurns based on task complexity (1 for simple Q&A, 3-5 for multi-step tasks, 5-10 for complex workflows)
- Enable webSearch only when the agent needs real-time information
- Generate relevant tags for organization
- Pick an appropriate emoji icon

Always respond conversationally. If generating a config, include a brief natural language summary before the <agent-config> block explaining what you built and why.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured. Please add it in Settings." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { messages } = body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: BUILDER_SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("");

    // Extract agent config if present
    const configMatch = textContent.match(
      /<agent-config>([\s\S]*?)<\/agent-config>/
    );

    let agentConfig = null;
    let conversationText = textContent;

    if (configMatch) {
      try {
        agentConfig = JSON.parse(configMatch[1].trim());
        // Remove the config block from conversation text
        conversationText = textContent
          .replace(/<agent-config>[\s\S]*?<\/agent-config>/, "")
          .trim();
      } catch {
        // If JSON parsing fails, treat as conversation
      }
    }

    return NextResponse.json({
      message: conversationText,
      agentConfig,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error("POST /api/agent-builder error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
