import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { LogEntry } from "@/types/agent";

function parseLogEntry(raw: {
  id: string;
  agentId: string;
  deploymentId: string | null;
  level: string;
  message: string;
  metadata: string;
  timestamp: Date;
}): LogEntry {
  return {
    id: raw.id,
    agentId: raw.agentId,
    deploymentId: raw.deploymentId,
    level: raw.level,
    message: raw.message,
    metadata: JSON.parse(raw.metadata) as Record<string, unknown>,
    timestamp: raw.timestamp.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await db.agent.findUnique({
      where: { id: params.id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const search = searchParams.get("search");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
      500
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const where: Record<string, unknown> = { agentId: params.id };

    if (level) {
      const validLevels = ["debug", "info", "warn", "error"];
      if (validLevels.includes(level)) {
        where.level = level;
      }
    }

    if (search) {
      where.message = { contains: search };
    }

    const [logs, total] = await Promise.all([
      db.logEntry.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      db.logEntry.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map(parseLogEntry),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    console.error(`GET /api/agents/${params.id}/logs error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
