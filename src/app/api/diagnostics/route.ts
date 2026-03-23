import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiKey } from "@/lib/get-api-key";
import { executeTool, getBuiltinToolDefinitions } from "@/lib/tool-executor";

export const runtime = "nodejs";

interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: unknown;
  durationMs: number;
}

async function runCheck(
  name: string,
  fn: () => Promise<{ status: DiagnosticResult["status"]; message: string; details?: unknown }>
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, ...result, durationMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      status: "fail",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export async function GET() {
  const results: DiagnosticResult[] = [];

  // 1. API Key check
  results.push(
    await runCheck("Anthropic API Key", async () => {
      const key = await getApiKey();
      if (!key) {
        return { status: "fail", message: "No API key configured. Go to Settings to add your Anthropic API key." };
      }
      const masked = key.slice(0, 10) + "..." + key.slice(-4);
      return { status: "pass", message: `API key configured (${masked})` };
    })
  );

  // 2. Database connectivity
  results.push(
    await runCheck("Database Connection", async () => {
      const count = await db.agent.count();
      return { status: "pass", message: `Connected. ${count} agents in database.`, details: { agentCount: count } };
    })
  );

  // 3. Filesystem tools
  results.push(
    await runCheck("Filesystem Tools (write_file)", async () => {
      const result = await executeTool("write_file", {
        path: "diagnostics-test/hello.txt",
        content: `Diagnostics test file created at ${new Date().toISOString()}`,
      });
      if (result.isError) {
        return { status: "fail", message: `write_file failed: ${result.output}` };
      }
      return { status: "pass", message: "write_file works", details: JSON.parse(result.output) };
    })
  );

  results.push(
    await runCheck("Filesystem Tools (read_file)", async () => {
      const result = await executeTool("read_file", { path: "diagnostics-test/hello.txt" });
      if (result.isError) {
        return { status: "fail", message: `read_file failed: ${result.output}` };
      }
      return { status: "pass", message: "read_file works", details: { content: result.output.slice(0, 100) } };
    })
  );

  results.push(
    await runCheck("Filesystem Tools (list_directory)", async () => {
      const result = await executeTool("list_directory", { path: "diagnostics-test" });
      if (result.isError) {
        return { status: "fail", message: `list_directory failed: ${result.output}` };
      }
      return { status: "pass", message: "list_directory works", details: JSON.parse(result.output) };
    })
  );

  // 4. Memory/ChromaDB
  results.push(
    await runCheck("Memory - List Collections", async () => {
      const result = await executeTool("memory_list_collections", {});
      if (result.isError) {
        return {
          status: "warn",
          message: `memory_list_collections returned error: ${result.output}. ChromaDB may not be running.`,
        };
      }
      const collections = JSON.parse(result.output);
      return {
        status: "pass",
        message: `${collections.length} memory collection(s) found`,
        details: collections,
      };
    })
  );

  results.push(
    await runCheck("Memory - DB Records", async () => {
      const collections = await db.memoryCollection.findMany({
        include: { _count: { select: { documents: true, agents: true } } },
      });
      const agentMemories = await db.agentMemory.count();
      return {
        status: "pass",
        message: `${collections.length} collections, ${agentMemories} agent-memory attachments`,
        details: collections.map((c) => ({
          name: c.name,
          documents: c._count.documents,
          agents: c._count.agents,
        })),
      };
    })
  );

  // 5. Skills
  results.push(
    await runCheck("Skills - Catalog", async () => {
      const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/skills`);
      if (!res.ok) {
        return { status: "fail", message: `Skills API returned ${res.status}` };
      }
      const data = await res.json();
      const skills = data.skills || [];
      return { status: "pass", message: `${skills.length} skills available`, details: skills.map((s: { id: string; name: string }) => s.name) };
    })
  );

  results.push(
    await runCheck("Skills - Agent Attachments", async () => {
      const count = await db.agentSkill.count();
      const agents = await db.agent.findMany({
        include: { skills: true, versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const withSkills = agents.filter((a) => {
        if (a.skills.length > 0) return true;
        const ver = a.versions[0];
        if (ver) {
          try {
            const def = JSON.parse(ver.definition);
            return def.skills?.length > 0;
          } catch { return false; }
        }
        return false;
      });
      return {
        status: "pass",
        message: `${count} skill attachments across ${withSkills.length} agents`,
        details: withSkills.map((a) => ({ name: a.name, dbSkills: a.skills.length })),
      };
    })
  );

  // 6. Tools
  results.push(
    await runCheck("Tools - Built-in Definitions", async () => {
      const defs = getBuiltinToolDefinitions();
      return {
        status: "pass",
        message: `${defs.length} built-in executable tools registered`,
        details: defs.map((d) => d.name),
      };
    })
  );

  results.push(
    await runCheck("Tools - Agent Attachments", async () => {
      const count = await db.agentTool.count();
      const agents = await db.agent.findMany({
        include: { tools: true, versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const withTools = agents.filter((a) => {
        if (a.tools.length > 0) return true;
        const ver = a.versions[0];
        if (ver) {
          try {
            const def = JSON.parse(ver.definition);
            return def.mcpServers?.length > 0 || def.tools?.length > 0;
          } catch { return false; }
        }
        return false;
      });
      return {
        status: "pass",
        message: `${count} tool attachments across ${withTools.length} agents`,
        details: withTools.map((a) => ({ name: a.name, dbTools: a.tools.length })),
      };
    })
  );

  // 7. Agent integration check - verify a sample agent has everything wired up
  results.push(
    await runCheck("Agent Integration - Sample Check", async () => {
      const agent = await db.agent.findFirst({
        include: {
          tools: true,
          skills: true,
          memories: { include: { collection: true } },
          versions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!agent) {
        return { status: "skip", message: "No agents found to check" };
      }

      const version = agent.versions[0];
      if (!version) {
        return { status: "warn", message: `Agent "${agent.name}" has no versions` };
      }

      let definition;
      try {
        definition = JSON.parse(version.definition);
      } catch {
        return { status: "fail", message: `Agent "${agent.name}" has invalid definition JSON` };
      }

      const issues: string[] = [];
      if (!definition.systemPrompt) issues.push("No system prompt");
      if (!definition.model) issues.push("No model configured");

      const hasDbTools = agent.tools.length > 0;
      const hasDefTools = definition.tools?.length > 0 || definition.mcpServers?.length > 0;
      const hasDbSkills = agent.skills.length > 0;
      const hasDefSkills = definition.skills?.length > 0;

      return {
        status: issues.length > 0 ? "warn" : "pass",
        message: issues.length > 0
          ? `Agent "${agent.name}": ${issues.join(", ")}`
          : `Agent "${agent.name}" is fully configured`,
        details: {
          name: agent.name,
          model: definition.model,
          dbTools: agent.tools.length,
          defTools: definition.tools?.length || 0,
          defMcpServers: definition.mcpServers?.length || 0,
          dbSkills: agent.skills.length,
          defSkills: definition.skills?.length || 0,
          memoryCollections: agent.memories.length,
          hasDbTools,
          hasDefTools,
          hasDbSkills,
          hasDefSkills,
          issues,
        },
      };
    })
  );

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    warn: results.filter((r) => r.status === "warn").length,
    skip: results.filter((r) => r.status === "skip").length,
  };

  return NextResponse.json({ summary, results });
}

// POST: Run a specific tool test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolName, input } = body as {
      toolName: string;
      input: Record<string, unknown>;
    };

    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    const result = await executeTool(toolName, input || {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to execute tool" },
      { status: 500 }
    );
  }
}
