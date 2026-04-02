import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/agents/[id]/tools - Attach a tool to this agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { toolId, config } = body as { toolId?: string; config?: string };

    if (!toolId) {
      return NextResponse.json({ error: "toolId is required" }, { status: 400 });
    }

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentTool = await db.agentTool.upsert({
      where: { agentId_toolId: { agentId: id, toolId } },
      create: { agentId: id, toolId, config: config || "{}" },
      update: { config: config || "{}" },
    });

    return NextResponse.json(agentTool, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents/[id]/tools error:", err);
    return NextResponse.json({ error: "Failed to attach tool" }, { status: 500 });
  }
}

// DELETE /api/agents/[id]/tools - Detach a tool from this agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("toolId");

    if (!toolId) {
      return NextResponse.json({ error: "toolId is required" }, { status: 400 });
    }

    await db.agentTool.deleteMany({
      where: { agentId: id, toolId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/agents/[id]/tools error:", err);
    return NextResponse.json({ error: "Failed to detach tool" }, { status: 500 });
  }
}
