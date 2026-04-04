import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChromaClient } from "@/lib/chromadb";

export const runtime = "nodejs";

// GET /api/memory/[id] - Get a single memory collection
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await db.memoryCollection.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { createdAt: "desc" } },
        agents: {
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(collection);
  } catch (err) {
    console.error("GET /api/memory/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/[id] - Delete a memory collection
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await db.memoryCollection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Try to delete from ChromaDB
    try {
      const chroma = getChromaClient();
      await chroma.deleteCollection({ name: collection.chromaId });
    } catch {
      // ChromaDB might not be running
    }

    await db.memoryCollection.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/memory/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}

// PUT /api/memory/[id] - Attach/detach collection to an agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { agentId, action } = await request.json();

    if (!agentId || !action) {
      return NextResponse.json(
        { error: "agentId and action are required" },
        { status: 400 }
      );
    }

    if (action === "attach") {
      await db.agentMemory.create({
        data: {
          agentId,
          collectionId: id,
        },
      });
    } else if (action === "detach") {
      await db.agentMemory.deleteMany({
        where: {
          agentId,
          collectionId: id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/memory/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update agent memory" },
      { status: 500 }
    );
  }
}
