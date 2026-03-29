import { NextRequest, NextResponse } from "next/server";
import { buildSkillZip } from "@/lib/skill-package";

export const runtime = "nodejs";

/**
 * POST /api/skills/export
 *
 * Export a skill as a standards-compliant .zip archive.
 * The archive is directly importable into Claude Code (~/.claude/skills/<name>/)
 * and other compatible runtimes without modification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content, category, version, triggers } = body;

    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }

    const zipBuffer = await buildSkillZip({
      name,
      description: description || "",
      content,
      category,
      version,
      triggers,
    });

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
      },
    });
  } catch (err) {
    console.error("POST /api/skills/export error:", err);
    return NextResponse.json(
      { error: "Failed to export skill" },
      { status: 500 }
    );
  }
}
