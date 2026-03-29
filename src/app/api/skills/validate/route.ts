import { NextRequest, NextResponse } from "next/server";
import { parseSkillZip } from "@/lib/skill-package";

export const runtime = "nodejs";

/**
 * POST /api/skills/validate
 *
 * Validate a skill package against the compatibility checklist without importing.
 * Returns validation results including whether the package is compatible with
 * Claude Code and other agent runtimes.
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
      zipBuffer = await request.arrayBuffer();
    }

    const { package: pkg, validation } = await parseSkillZip(zipBuffer);

    // Additional compatibility checks
    const compatibility = {
      claudeCode: true,
      maestroAgentica: true,
      genericRuntime: true,
    };

    // Check Claude Code compatibility: needs kebab-case name and SKILL.md
    if (validation.errors.some((e) => e.includes("kebab-case"))) {
      compatibility.claudeCode = false;
    }
    if (validation.errors.some((e) => e.includes("SKILL.md"))) {
      compatibility.claudeCode = false;
      compatibility.genericRuntime = false;
    }
    if (!validation.valid) {
      compatibility.maestroAgentica = false;
    }

    return NextResponse.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      compatibility,
      metadata: {
        name: pkg.frontmatter.name,
        description: pkg.frontmatter.description,
        version: pkg.frontmatter.version,
        triggers: pkg.frontmatter.triggers,
        hasScripts: pkg.scripts.length > 0,
        hasSamples: pkg.samples.length > 0,
        hasTests: pkg.tests.length > 0,
        hasReadme: !!pkg.readme,
      },
    });
  } catch (err) {
    console.error("POST /api/skills/validate error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to validate skill package";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
