import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Agent, AgentVersion, StoredAgentDefinition } from "@/types/agent";

function parseAgent(raw: {
  id: string;
  name: string;
  description: string;
  status: string;
  icon: string | null;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
  versions?: {
    id: string;
    agentId: string;
    version: string;
    definition: string;
    changelog: string;
    parentId: string | null;
    tag: string | null;
    createdAt: Date;
  }[];
}): Agent {
  const latestVersion = raw.versions?.[0];
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    status: raw.status as Agent["status"],
    icon: raw.icon,
    tags: JSON.parse(raw.tags) as string[],
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    latestVersion: latestVersion
      ? {
          id: latestVersion.id,
          agentId: latestVersion.agentId,
          version: latestVersion.version,
          definition: JSON.parse(latestVersion.definition) as StoredAgentDefinition,
          changelog: latestVersion.changelog,
          parentId: latestVersion.parentId,
          tag: latestVersion.tag,
          createdAt: latestVersion.createdAt.toISOString(),
        }
      : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const agents = await db.agent.findMany({
      where,
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const parsed = agents.map((a) => {
      const base = parseAgent(a);
      return {
        ...base,
        versions: a.versions.map((v) => ({ id: v.id, version: v.version })),
      };
    });
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("GET /api/agents error:", err);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, definition } = body as {
      name?: string;
      description?: string;
      definition?: StoredAgentDefinition;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!definition || typeof definition !== "object") {
      return NextResponse.json(
        { error: "Definition is required" },
        { status: 400 }
      );
    }

    const agent = await db.agent.create({
      data: {
        name: name.trim(),
        description: (description ?? "").trim(),
        status: "draft",
        versions: {
          create: {
            version: "v0.1.0",
            definition: JSON.stringify(definition),
            changelog: "Initial version",
          },
        },
      },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const parsed = parseAgent(agent);
    return NextResponse.json(parsed, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents error:", err);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
