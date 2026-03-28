import JSZip from "jszip";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  triggers?: string[];
  type?: string;
}

export interface SkillPackageFile {
  path: string;
  content: string;
}

export interface SkillPackage {
  frontmatter: SkillFrontmatter;
  markdownBody: string;
  fullContent: string; // The raw SKILL.md content
  readme?: string;
  scripts: SkillPackageFile[];
  samples: SkillPackageFile[];
  tests: SkillPackageFile[];
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// ── YAML Frontmatter Parsing ─────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Handles simple key: value and key: [array] syntax without a full YAML parser.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, body: trimmed };
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: trimmed };
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();
  const frontmatter: Record<string, unknown> = {};

  let currentKey: string | null = null;
  let arrayValues: string[] = [];
  let inArray = false;

  for (const line of yamlBlock.split("\n")) {
    const trimmedLine = line.trim();

    // Array item continuation
    if (inArray && trimmedLine.startsWith("- ")) {
      const val = trimmedLine.slice(2).trim().replace(/^["']|["']$/g, "");
      arrayValues.push(val);
      continue;
    }

    // Flush previous array
    if (inArray && currentKey) {
      frontmatter[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
      currentKey = null;
    }

    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const colonIdx = trimmedLine.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmedLine.slice(0, colonIdx).trim();
    const value = trimmedLine.slice(colonIdx + 1).trim();

    if (!value) {
      // Could be start of an array block
      currentKey = key;
      inArray = true;
      arrayValues = [];
      continue;
    }

    // Inline array: [val1, val2]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      frontmatter[key] = inner
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    // Strip quotes
    frontmatter[key] = value.replace(/^["']|["']$/g, "");
  }

  // Flush trailing array
  if (inArray && currentKey) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter, body };
}

/**
 * Serialize frontmatter fields back to YAML-style string.
 */
export function serializeFrontmatter(fm: SkillFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${fm.name}`);
  lines.push(`description: ${fm.description}`);
  if (fm.version) lines.push(`version: ${fm.version}`);
  if (fm.triggers && fm.triggers.length > 0) {
    lines.push("triggers:");
    for (const t of fm.triggers) {
      lines.push(`  - "${t}"`);
    }
  }
  if (fm.type) lines.push(`type: ${fm.type}`);
  lines.push("---");
  return lines.join("\n");
}

// ── Kebab-case validation ────────────────────────────────────────────────────

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isKebabCase(s: string): boolean {
  return KEBAB_CASE_RE.test(s);
}

// ── Skill Package Validation ─────────────────────────────────────────────────

/**
 * Validate a parsed skill package against the compatibility checklist.
 */
export function validateSkillPackage(pkg: SkillPackage): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // SKILL.md must exist (caller ensures this, but check frontmatter)
  if (!pkg.frontmatter.name) {
    errors.push("SKILL.md frontmatter is missing the required 'name' field.");
  }
  if (!pkg.frontmatter.description) {
    errors.push("SKILL.md frontmatter is missing the required 'description' field.");
  }

  // Name must be kebab-case
  if (pkg.frontmatter.name && !isKebabCase(pkg.frontmatter.name)) {
    errors.push(
      `Skill name '${pkg.frontmatter.name}' is not kebab-case. Use lowercase letters, numbers, and hyphens (e.g., 'analyze-csv').`
    );
  }

  // Version is recommended
  if (!pkg.frontmatter.version) {
    warnings.push("SKILL.md frontmatter is missing 'version'. Defaulting to '1.0.0'.");
  }

  // Markdown body should have content
  if (!pkg.markdownBody.trim()) {
    warnings.push("SKILL.md has no instruction body after frontmatter.");
  }

  // Check that referenced scripts exist
  const scriptRefs = extractScriptReferences(pkg.markdownBody);
  for (const ref of scriptRefs) {
    const found = pkg.scripts.some((s) => s.path === ref || s.path.endsWith(ref));
    if (!found) {
      warnings.push(`Referenced script '${ref}' not found in package.`);
    }
  }

  // README is optional but recommended
  if (!pkg.readme) {
    warnings.push("No README.md found. Consider adding human-facing documentation.");
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Extract script path references from markdown body (simple heuristic).
 */
function extractScriptReferences(body: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /scripts\/[\w.-]+\.(py|js|ts|sh)/g,
    /`(scripts\/[\w.-]+\.(py|js|ts|sh))`/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const ref = match[1] || match[0];
      if (!refs.includes(ref)) refs.push(ref);
    }
  }
  return refs;
}

// ── Import: Parse a .zip into a SkillPackage ─────────────────────────────────

/**
 * Parse a ZIP buffer into a SkillPackage. Supports both:
 * - Canonical format: <skill-name>/SKILL.md  (root folder wrapping)
 * - Flat format: SKILL.md at zip root
 * - Legacy format: skill.json + skill.md at zip root
 */
export async function parseSkillZip(
  zipBuffer: ArrayBuffer | Buffer | Uint8Array
): Promise<{ package: SkillPackage; validation: ValidationResult }> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Determine root: could be flat or wrapped in a single directory
  const entries = Object.keys(zip.files).filter(
    (e) => !e.startsWith("__MACOSX/") && !e.startsWith(".")
  );
  let prefix = "";

  // Check if all files share a common root directory
  const topLevel = new Set(
    entries.map((e) => e.split("/")[0]).filter(Boolean)
  );
  if (topLevel.size === 1) {
    const root = Array.from(topLevel)[0];
    const rootEntry = zip.files[root + "/"];
    if (rootEntry?.dir) {
      prefix = root + "/";
    }
  }

  // Resolve SKILL.md (canonical) or skill.md (legacy)
  const resolveFile = (name: string) => zip.file(prefix + name);

  let skillMdFile = resolveFile("SKILL.md");
  const legacySkillMd = resolveFile("skill.md");
  const legacySkillJson = resolveFile("skill.json");

  // Handle legacy format (skill.json + skill.md)
  if (!skillMdFile && legacySkillJson && legacySkillMd) {
    return parseLegacyFormat(legacySkillJson, legacySkillMd, zip, prefix);
  }

  // Fall back to lowercase skill.md
  if (!skillMdFile && legacySkillMd) {
    skillMdFile = legacySkillMd;
  }

  if (!skillMdFile) {
    throw new Error(
      "Invalid skill package: SKILL.md not found. The package must contain a SKILL.md file."
    );
  }

  const fullContent = await skillMdFile.async("string");
  const { frontmatter: rawFm, body } = parseFrontmatter(fullContent);

  const frontmatter: SkillFrontmatter = {
    name: (rawFm.name as string) || "",
    description: (rawFm.description as string) || "",
    version: (rawFm.version as string) || "1.0.0",
    triggers: (rawFm.triggers as string[]) || [],
    type: (rawFm.type as string) || "skill",
  };

  // Read optional files
  const readmeFile = resolveFile("README.md");
  const readme = readmeFile ? await readmeFile.async("string") : undefined;

  // Collect scripts, samples, tests
  const scripts = await collectFiles(zip, prefix + "scripts/");
  const samples = await collectFiles(zip, prefix + "samples/");
  const tests = await collectFiles(zip, prefix + "tests/");

  const pkg: SkillPackage = {
    frontmatter,
    markdownBody: body,
    fullContent,
    readme,
    scripts,
    samples,
    tests,
  };

  const validation = validateSkillPackage(pkg);

  return { package: pkg, validation };
}

/**
 * Parse legacy format (skill.json + skill.md) into a canonical SkillPackage.
 */
async function parseLegacyFormat(
  jsonFile: JSZip.JSZipObject,
  mdFile: JSZip.JSZipObject,
  zip: JSZip,
  prefix: string
): Promise<{ package: SkillPackage; validation: ValidationResult }> {
  const metaJson = await jsonFile.async("string");
  const content = await mdFile.async("string");

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(metaJson);
  } catch {
    throw new Error("Invalid skill.json — could not parse metadata.");
  }

  // The skill.md content already has frontmatter in legacy format
  const { frontmatter: rawFm, body } = parseFrontmatter(content);

  const name =
    (rawFm.name as string) ||
    (meta.name as string) ||
    "";
  const description =
    (rawFm.description as string) ||
    (meta.description as string) ||
    "";

  const frontmatter: SkillFrontmatter = {
    name: toKebabCase(name),
    description,
    version: (meta.version as string) || (rawFm.version as string) || "1.0.0",
    triggers: (rawFm.triggers as string[]) || [],
    type: (rawFm.type as string) || "skill",
  };

  // Reconstruct full SKILL.md content
  const fullContent = `${serializeFrontmatter(frontmatter)}\n\n${body}`;

  const scripts = await collectFiles(zip, prefix + "scripts/");
  const samples = await collectFiles(zip, prefix + "samples/");
  const tests = await collectFiles(zip, prefix + "tests/");

  const pkg: SkillPackage = {
    frontmatter,
    markdownBody: body,
    fullContent,
    scripts,
    samples,
    tests,
  };

  const validation = validateSkillPackage(pkg);
  validation.warnings.unshift(
    "Package was in legacy format (skill.json + skill.md). It has been converted to canonical SKILL.md format."
  );

  return { package: pkg, validation };
}

/**
 * Collect all files under a given directory prefix in the zip.
 */
async function collectFiles(
  zip: JSZip,
  dirPrefix: string
): Promise<SkillPackageFile[]> {
  const files: SkillPackageFile[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (path.startsWith(dirPrefix) && !entry.dir && !path.includes("__MACOSX")) {
      const relativePath = path.slice(dirPrefix.length);
      if (relativePath && !relativePath.startsWith(".")) {
        files.push({
          path: relativePath,
          content: await entry.async("string"),
        });
      }
    }
  }
  return files;
}

// ── Export: Build a .zip from skill data ──────────────────────────────────────

export interface ExportSkillInput {
  name: string;
  description: string;
  content: string; // The full SKILL.md content (with frontmatter)
  category?: string;
  version?: string;
  triggers?: string[];
  scripts?: SkillPackageFile[];
  samples?: SkillPackageFile[];
  tests?: SkillPackageFile[];
}

/**
 * Build a standards-compliant skill .zip archive.
 * The archive unpacks to a single root folder matching the skill name.
 */
export async function buildSkillZip(input: ExportSkillInput): Promise<Buffer> {
  const { frontmatter: rawFm, body } = parseFrontmatter(input.content);

  // Determine the kebab-case skill name
  const skillName =
    (rawFm.name as string) ||
    toKebabCase(input.name);

  const kebabName = isKebabCase(skillName) ? skillName : toKebabCase(skillName);

  // Build SKILL.md with proper frontmatter
  const fm: SkillFrontmatter = {
    name: kebabName,
    description: (rawFm.description as string) || input.description,
    version: input.version || (rawFm.version as string) || "1.0.0",
    triggers: input.triggers || (rawFm.triggers as string[]) || [],
    type: (rawFm.type as string) || "skill",
  };

  const skillMd = `${serializeFrontmatter(fm)}\n\n${body}`;

  // Build README.md
  const readme = `# ${input.name}

${input.description}

## Version
${fm.version}

## Usage

This skill can be imported into:
- **Claude Code**: Copy to \`~/.claude/skills/${kebabName}/\`
- **MaestroAgentica**: Import via Skills → Import Skill
- **Other compatible runtimes**: Extract and place in the skill directory

## Slash Command
\`/${kebabName}\`
${fm.triggers && fm.triggers.length > 0 ? `\n## Triggers\n${fm.triggers.map((t) => `- "${t}"`).join("\n")}\n` : ""}
---
*Exported from Maestro Agentica*
`;

  const zip = new JSZip();
  const folder = zip.folder(kebabName)!;

  // Required
  folder.file("SKILL.md", skillMd);

  // Optional
  folder.file("README.md", readme);

  // Scripts
  if (input.scripts && input.scripts.length > 0) {
    for (const s of input.scripts) {
      folder.file(`scripts/${s.path}`, s.content);
    }
  }

  // Samples
  if (input.samples && input.samples.length > 0) {
    for (const s of input.samples) {
      folder.file(`samples/${s.path}`, s.content);
    }
  }

  // Tests
  if (input.tests && input.tests.length > 0) {
    for (const t of input.tests) {
      folder.file(`tests/${t.path}`, t.content);
    }
  }

  return zip.generateAsync({ type: "nodebuffer" }) as Promise<Buffer>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toKebabCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
