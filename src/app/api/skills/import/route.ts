import { NextRequest, NextResponse } from "next/server";
import { parseSkillZip } from "@/lib/skill-package";

export const runtime = "nodejs";

/**
 * POST /api/skills/import
 *
 * Import a skill from a .zip archive. Accepts both:
 * - Canonical format: SKILL.md-based package
 * - Legacy format: skill.json + skill.md package
 * - External sources: GitHub repos, Claude marketplace, manual upload
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let zipBuffer: ArrayBuffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }
      zipBuffer = await file.arrayBuffer();
    } else {
      // Raw binary body
      zipBuffer = await request.arrayBuffer();
    }

    // Parse and validate the skill package
    const { package: pkg, validation } = await parseSkillZip(zipBuffer);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Invalid skill package",
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Build the skill object for the system
    const skill = {
      id: `imported_${Date.now()}`,
      name: formatDisplayName(pkg.frontmatter.name),
      description: pkg.frontmatter.description,
      category: "Custom",
      content: pkg.fullContent,
      version: pkg.frontmatter.version || "1.0.0",
      triggers: pkg.frontmatter.triggers || [],
      isCustom: true,
      isImported: true,
      packageName: pkg.frontmatter.name,
      scripts: pkg.scripts.map((s) => s.path),
      hasReadme: !!pkg.readme,
      hasSamples: pkg.samples.length > 0,
      hasTests: pkg.tests.length > 0,
    };

    return NextResponse.json(
      {
        skill,
        validation: {
          valid: true,
          warnings: validation.warnings,
          errors: [],
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/skills/import error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to import skill";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function formatDisplayName(kebabName: string): string {
  return kebabName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
