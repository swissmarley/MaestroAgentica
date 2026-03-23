import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { StoredAgentDefinition } from "@/types/agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body as { description?: string };

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are an expert AI agent designer. Given a natural language description, generate a complete agent definition as a JSON object.

The JSON must conform to this TypeScript interface:

interface ToolDefinition {
  name: string;           // snake_case tool name
  description: string;    // clear description of what the tool does
  input_schema: object;   // JSON Schema for the tool input
}

interface StoredAgentDefinition {
  model: string;          // Anthropic model ID (e.g., "claude-sonnet-4-20250514")
  systemPrompt: string;   // detailed system prompt for the agent
  tools: ToolDefinition[];// array of tools the agent can use
  maxTurns: number;       // maximum agentic loop turns (1-10)
  temperature?: number;   // optional, 0-1
}

Guidelines:
- Write a detailed, well-structured system prompt that clearly defines the agent's role, capabilities, and behavior
- Define relevant tools with proper JSON Schema input_schemas
- Choose an appropriate model (default to "claude-sonnet-4-20250514")
- Set maxTurns based on complexity (simple Q&A: 1, multi-step tasks: 3-5, complex workflows: 5-10)
- Set temperature based on the task (factual/deterministic: 0-0.3, creative: 0.7-1.0)

Respond with ONLY the JSON object. No markdown, no explanation, no code fences.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate an agent definition for the following description:\n\n${description.trim()}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No text response from model" },
        { status: 500 }
      );
    }

    let definition: StoredAgentDefinition;
    try {
      // Try to parse the raw text, stripping any accidental markdown fences
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      definition = JSON.parse(jsonStr) as StoredAgentDefinition;
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse generated definition",
          raw: textContent.text,
        },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!definition.model || !definition.systemPrompt || !definition.tools) {
      return NextResponse.json(
        {
          error: "Generated definition is missing required fields",
          definition,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(definition);
  } catch (err) {
    console.error("POST /api/generate error:", err);
    return NextResponse.json(
      { error: "Failed to generate agent definition" },
      { status: 500 }
    );
  }
}
