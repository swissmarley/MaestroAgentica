import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AgentVersion, StoredAgentDefinition } from "@/types/agent";
import semver from "semver";

function parseVersion(raw: {
  id: string;
  agentId: string;
  version: string;
  definition: string;
  changelog: string;
  parentId: string | null;
  tag: string | null;
  createdAt: Date;
}): AgentVersion {
  return {
    id: raw.id,
    agentId: raw.agentId,
    version: raw.version,
    definition: JSON.parse(raw.definition) as StoredAgentDefinition,
    changelog: raw.changelog,
    parentId: raw.parentId,
    tag: raw.tag,
    createdAt: raw.createdAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await db.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const versions = await db.agentVersion.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(versions.map(parseVersion));
  } catch (err) {
    console.error(`GET /api/agents/${id}/versions error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { changelog } = body as { changelog?: string };
    let { definition } = body as { definition?: StoredAgentDefinition | string };

    if (!definition) {
      return NextResponse.json(
        { error: "Definition is required" },
        { status: 400 }
      );
    }

    // Accept definition as either a JSON string or an object
    if (typeof definition === "string") {
      try {
        definition = JSON.parse(definition) as StoredAgentDefinition;
      } catch {
        return NextResponse.json(
          { error: "Invalid definition JSON" },
          { status: 400 }
        );
      }
    }

    const agent = await db.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get the latest version to determine the next version number
    const latestVersion = await db.agentVersion.findFirst({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
    });

    let nextVersion = "v0.1.0";
    if (latestVersion) {
      const cleanVersion = latestVersion.version.replace(/^v/, "");
      const incremented = semver.inc(cleanVersion, "minor");
      nextVersion = `v${incremented ?? "0.1.0"}`;
    }

    const version = await db.agentVersion.create({
      data: {
        agentId: id,
        version: nextVersion,
        definition: JSON.stringify(definition),
        changelog: (changelog ?? "").trim(),
        parentId: latestVersion?.id ?? null,
      },
    });

    // Touch the agent's updatedAt
    await db.agent.update({
      where: { id: id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(parseVersion(version), { status: 201 });
  } catch (err) {
    console.error(`POST /api/agents/${id}/versions error:`, err);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
