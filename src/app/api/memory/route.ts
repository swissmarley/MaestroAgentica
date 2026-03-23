import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChromaClient } from "@/lib/chromadb";

export const runtime = "nodejs";

// GET /api/memory - List all memory collections
export async function GET() {
  try {
    const collections = await db.memoryCollection.findMany({
      include: {
        documents: true,
        agents: {
          include: { agent: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(collections);
  } catch (err) {
    console.error("GET /api/memory error:", err);
    return NextResponse.json(
      { error: "Failed to fetch memory collections" },
      { status: 500 }
    );
  }
}

// POST /api/memory - Create a new memory collection
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    const chromaId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create ChromaDB collection
    try {
      const chroma = getChromaClient();
      await chroma.createCollection({
        name: chromaId,
        metadata: { description: description || "", source: "agentica" },
      });
    } catch (chromaErr) {
      console.warn("ChromaDB not available, using metadata-only mode:", chromaErr);
      // Continue without ChromaDB - store metadata in SQLite
    }

    const collection = await db.memoryCollection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        chromaId,
      },
      include: { documents: true, agents: true },
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (err) {
    console.error("POST /api/memory error:", err);
    return NextResponse.json(
      { error: "Failed to create memory collection" },
      { status: 500 }
    );
  }
}
