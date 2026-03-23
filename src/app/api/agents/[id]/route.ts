import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Agent, StoredAgentDefinition } from "@/types/agent";

function parseAgentWithVersions(raw: {
  id: string;
  name: string;
  description: string;
  status: string;
  icon: string | null;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
  versions: {
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
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    status: raw.status as Agent["status"],
    icon: raw.icon,
    tags: JSON.parse(raw.tags) as string[],
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    versions: raw.versions.map((v) => ({
      id: v.id,
      agentId: v.agentId,
      version: v.version,
      definition: JSON.parse(v.definition) as StoredAgentDefinition,
      changelog: v.changelog,
      parentId: v.parentId,
      tag: v.tag,
      createdAt: v.createdAt.toISOString(),
    })),
    latestVersion: raw.versions[0]
      ? {
          id: raw.versions[0].id,
          agentId: raw.versions[0].agentId,
          version: raw.versions[0].version,
          definition: JSON.parse(raw.versions[0].definition) as StoredAgentDefinition,
          changelog: raw.versions[0].changelog,
          parentId: raw.versions[0].parentId,
          tag: raw.versions[0].tag,
          createdAt: raw.versions[0].createdAt.toISOString(),
        }
      : undefined,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await db.agent.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
        memories: {
          include: {
            collection: {
              select: { id: true, name: true, description: true, totalSize: true },
            },
          },
        },
        tools: {
          orderBy: { createdAt: "desc" },
        },
        skills: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const parsed = parseAgentWithVersions(agent);
    const agentAny = agent as unknown as { memories: unknown[]; tools: unknown[]; skills: unknown[] };
    return NextResponse.json({
      ...parsed,
      memories: agentAny.memories || [],
      tools: agentAny.tools || [],
      skills: agentAny.skills || [],
    });
  } catch (err) {
    console.error(`GET /api/agents/${params.id} error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, status, tags } = body as {
      name?: string;
      description?: string;
      status?: string;
      tags?: string[];
    };

    const existing = await db.agent.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description.trim();
    if (status !== undefined) {
      const validStatuses = ["draft", "active", "paused", "archived"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = status;
    }
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: "Tags must be an array" },
          { status: 400 }
        );
      }
      data.tags = JSON.stringify(tags);
    }

    const agent = await db.agent.update({
      where: { id: params.id },
      data,
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(parseAgentWithVersions(agent));
  } catch (err) {
    console.error(`PUT /api/agents/${params.id} error:`, err);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await db.agent.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await db.agent.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/agents/${params.id} error:`, err);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
