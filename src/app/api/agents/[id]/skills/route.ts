import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/agents/[id]/skills - Attach a skill to this agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { skillId } = body as { skillId?: string };

    if (!skillId) {
      return NextResponse.json({ error: "skillId is required" }, { status: 400 });
    }

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentSkill = await db.agentSkill.upsert({
      where: { agentId_skillId: { agentId: id, skillId } },
      create: { agentId: id, skillId },
      update: {},
    });

    return NextResponse.json(agentSkill, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents/[id]/skills error:", err);
    return NextResponse.json({ error: "Failed to attach skill" }, { status: 500 });
  }
}

// DELETE /api/agents/[id]/skills - Detach a skill from this agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("skillId");

    if (!skillId) {
      return NextResponse.json({ error: "skillId is required" }, { status: 400 });
    }

    await db.agentSkill.deleteMany({
      where: { agentId: id, skillId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/agents/[id]/skills error:", err);
    return NextResponse.json({ error: "Failed to detach skill" }, { status: 500 });
  }
}
