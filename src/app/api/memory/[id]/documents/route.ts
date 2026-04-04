import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChromaClient, chunkText, parseFileContent, parseBinaryFile, isBinaryFileType } from "@/lib/chromadb";

export const runtime = "nodejs";

// POST /api/memory/[id]/documents - Upload a document to a collection
export async function POST(
  request: NextRequest,
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("content") as string | null;
    const fileName = formData.get("fileName") as string || file?.name || "untitled.txt";

    let parsedContent: string;
    let fileSize: number;

    if (file) {
      fileSize = file.size;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (isBinaryFileType(fileName)) {
        // Binary file: PDF, DOCX, XLSX
        parsedContent = await parseBinaryFile(buffer, fileName);
      } else {
        // Text-based file
        const rawText = buffer.toString("utf-8");
        parsedContent = parseFileContent(rawText, fileName);
      }
    } else if (textContent) {
      parsedContent = parseFileContent(textContent, fileName);
      fileSize = new Blob([textContent]).size;
    } else {
      return NextResponse.json(
        { error: "Either a file or text content is required" },
        { status: 400 }
      );
    }

    if (!parsedContent.trim()) {
      return NextResponse.json(
        { error: "No text content could be extracted from the file" },
        { status: 400 }
      );
    }

    const chunks = chunkText(parsedContent);

    // Create document record
    const doc = await db.memoryDocument.create({
      data: {
        collectionId: id,
        fileName,
        fileSize,
        chunkCount: chunks.length,
        status: "processing",
      },
    });

    // Try to add to ChromaDB
    try {
      const chroma = getChromaClient();
      const chromaCollection = await chroma.getCollection({
        name: collection.chromaId,
      });

      const ids = chunks.map((_, i) => `${doc.id}_chunk_${i}`);
      const metadatas = chunks.map((_, i) => ({
        documentId: doc.id,
        fileName,
        chunkIndex: i,
        totalChunks: chunks.length,
      }));

      await chromaCollection.add({
        ids,
        documents: chunks,
        metadatas,
      });

      await db.memoryDocument.update({
        where: { id: doc.id },
        data: { status: "ready" },
      });
    } catch (chromaErr) {
      console.warn("ChromaDB not available, document stored as metadata only:", chromaErr);
      await db.memoryDocument.update({
        where: { id: doc.id },
        data: { status: "metadata_only" },
      });
    }

    // Update total size
    await db.memoryCollection.update({
      where: { id: id },
      data: {
        totalSize: {
          increment: fileSize,
        },
      },
    });

    const updatedDoc = await db.memoryDocument.findUnique({
      where: { id: doc.id },
    });

    return NextResponse.json(updatedDoc, { status: 201 });
  } catch (err) {
    console.error("POST /api/memory/[id]/documents error:", err);
    const message = err instanceof Error ? err.message : "Failed to upload document";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
