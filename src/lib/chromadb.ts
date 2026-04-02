import { ChromaClient } from "chromadb";

let client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://localhost:8000",
    });
  }
  return client;
}

/**
 * Split text into chunks for embedding.
 * Simple sentence-aware chunking with overlap.
 */
export function chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
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
 * Parse binary file formats (PDF, DOCX, XLSX).
 * Returns extracted text content.
 */
export async function parseBinaryFile(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf": {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
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
        throw new Error("Failed to parse DOCX file. Ensure mammoth is installed.");
      }
    }
    case "xlsx":
    case "xls": {
      try {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
        const texts: string[] = [];
        workbook.eachSheet((sheet) => {
          const rows: string[] = [];
          sheet.eachRow((row) => {
            const values = (Array.isArray(row.values) ? row.values.slice(1) : [])
              .map((v) => (v != null ? String(v) : ""));
            rows.push(values.join(","));
          });
          texts.push(`Sheet: ${sheet.name}\n${rows.join("\n")}`);
        });
        return texts.join("\n\n");
      } catch (err) {
        console.error("XLSX parse error:", err);
        throw new Error("Failed to parse XLSX file. Ensure exceljs is installed.");
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
