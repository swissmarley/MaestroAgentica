import fs from "fs/promises";
import path from "path";

// ── File-based vector store (no external server required) ─────────────────
//
// Each collection is persisted as a JSON file under VECTOR_DB_PATH.
// Queries use term-overlap scoring — no embedding model or network call needed.

const DB_DIR =
  process.env.VECTOR_DB_PATH ?? path.join(process.cwd(), "vectordb");

interface StoredDocument {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

interface CollectionStore {
  name: string;
  metadata: Record<string, unknown>;
  documents: StoredDocument[];
}

class LocalCollection {
  private filePath: string;

  constructor(
    readonly name: string,
    dbDir: string,
  ) {
    this.filePath = path.join(dbDir, `${name}.json`);
  }

  async add({
    ids,
    documents,
    metadatas,
  }: {
    ids: string[];
    documents: string[];
    metadatas?: Record<string, unknown>[];
  }): Promise<void> {
    if (ids.length === 0) return;
    const store = await this._load();
    for (let i = 0; i < ids.length; i++) {
      const entry: StoredDocument = {
        id: ids[i],
        text: documents[i],
        metadata: metadatas?.[i] ?? {},
      };
      const idx = store.documents.findIndex((d) => d.id === ids[i]);
      if (idx >= 0) {
        store.documents[idx] = entry;
      } else {
        store.documents.push(entry);
      }
    }
    await this._save(store);
  }

  async query({
    queryTexts,
    nResults = 5,
  }: {
    queryTexts: string[];
    nResults?: number;
  }) {
    const store = await this._load();
    const queryWords = queryTexts[0]
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const scored = store.documents.map((doc) => {
      const text = doc.text.toLowerCase();
      const hits = queryWords.reduce(
        (n, w) => n + (text.includes(w) ? 1 : 0),
        0,
      );
      return { doc, score: hits };
    });

    const topK = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, nResults);

    const maxWords = Math.max(1, queryWords.length);
    return {
      documents: [topK.map((r) => r.doc.text)],
      metadatas: [topK.map((r) => r.doc.metadata)],
      ids: [topK.map((r) => r.doc.id)],
      distances: [topK.map((r) => 1 - r.score / maxWords)],
    };
  }

  private async _load(): Promise<CollectionStore> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as CollectionStore;
    } catch {
      return { name: this.name, metadata: {}, documents: [] };
    }
  }

  private async _save(store: CollectionStore): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(store, null, 2),
      "utf-8",
    );
  }
}

class LocalVectorClient {
  constructor(private dbDir: string) {}

  async createCollection({
    name,
    metadata,
  }: {
    name: string;
    metadata?: Record<string, unknown>;
  }): Promise<LocalCollection> {
    const filePath = path.join(this.dbDir, `${name}.json`);
    const store: CollectionStore = {
      name,
      metadata: metadata ?? {},
      documents: [],
    };
    await fs.mkdir(this.dbDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
    return new LocalCollection(name, this.dbDir);
  }

  async getCollection({ name }: { name: string }): Promise<LocalCollection> {
    return new LocalCollection(name, this.dbDir);
  }

  async deleteCollection({ name }: { name: string }): Promise<void> {
    try {
      await fs.unlink(path.join(this.dbDir, `${name}.json`));
    } catch {
      // File may not exist — that's fine
    }
  }

  async listCollections(): Promise<Array<{ name: string }>> {
    try {
      const files = await fs.readdir(this.dbDir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ name: f.slice(0, -5) }));
    } catch {
      return [];
    }
  }
}

let vectorClient: LocalVectorClient | null = null;

export function getChromaClient(): LocalVectorClient {
  if (!vectorClient) {
    vectorClient = new LocalVectorClient(DB_DIR);
  }
  return vectorClient;
}

// ── Text chunking ──────────────────────────────────────────────────────────

/**
 * Split text into chunks for storage.
 * Simple sentence-aware chunking with overlap.
 */
export function chunkText(
  text: string,
  maxChunkSize = 1000,
  overlap = 200,
): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      currentChunk.length + sentence.length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(overlap / 5));
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// ── File parsers ───────────────────────────────────────────────────────────

/**
 * Parse text from common file types.
 * Supports plain text, markdown, and basic document formats.
 */
export function parseFileContent(content: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "md":
    case "markdown":
      return content
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\*|__/g, "")
        .replace(/\*|_/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]*`/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .trim();
    case "json":
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    case "csv":
      return content.replace(/,/g, " | ");
    case "rtf":
      // Strip RTF control words, keep text
      return content
        .replace(/\\[a-z]+\d*\s?/gi, "")
        .replace(/[{}]/g, "")
        .replace(/\\\\/g, "\\")
        .replace(/\\'/g, "'")
        .trim();
    default:
      return content;
  }
}

/**
 * Parse binary file formats (PDF, DOCX, XLSX, XLS).
 * Returns extracted text content.
 */
export async function parseBinaryFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf": {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (
          buf: Buffer,
        ) => Promise<{ text: string }>;
        const result = await pdfParse(buffer);
        return result.text || "";
      } catch (err) {
        console.error("PDF parse error:", err);
        throw new Error("Failed to parse PDF file. Ensure pdf-parse is installed.");
      }
    }
    case "docx": {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
      } catch (err) {
        console.error("DOCX parse error:", err);
        throw new Error(
          "Failed to parse DOCX file. Ensure mammoth is installed.",
        );
      }
    }
    case "xlsx":
    case "xls": {
      // Use the `xlsx` library which supports both OOXML (.xlsx) and legacy
      // BIFF (.xls) workbook formats via a single XLSX.read() call.
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const texts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          texts.push(`Sheet: ${sheetName}\n${csv}`);
        }
        return texts.join("\n\n");
      } catch (err) {
        console.error("XLSX parse error:", err);
        throw new Error(
          "Failed to parse spreadsheet. Ensure xlsx is installed.",
        );
      }
    }
    default:
      // For non-binary types, decode as UTF-8
      return buffer.toString("utf-8");
  }
}

/** Check if file type requires binary parsing */
export function isBinaryFileType(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["pdf", "docx", "xlsx", "xls"].includes(ext || "");
}
