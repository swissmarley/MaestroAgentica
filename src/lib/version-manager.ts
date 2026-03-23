import { db } from "@/lib/db";
import { serializeDefinition, deserializeDefinition } from "@/lib/agent-serializer";
import type { StoredAgentDefinition, AgentVersion } from "@/types/agent";
import * as semver from "semver";
import { diff as deepDiff } from "deep-diff";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VersionDiffEntry {
  kind: "N" | "D" | "E" | "A";
  path: string[];
  lhs?: unknown;
  rhs?: unknown;
  index?: number;
  item?: { kind: "N" | "D" | "E" | "A"; lhs?: unknown; rhs?: unknown };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rawToAgentVersion(raw: {
  id: string;
  agentId: string;
  version: string;
  definition: string;
  changelog: string;
  parentId: string | null;
  tag: string | null;
  createdAt: Date;
}): AgentVersion {
  return {
    id: raw.id,
    agentId: raw.agentId,
    version: raw.version,
    definition: deserializeDefinition(raw.definition),
    changelog: raw.changelog,
    parentId: raw.parentId,
    tag: raw.tag,
    createdAt: raw.createdAt.toISOString(),
  };
}

/**
 * Compute the next semver patch version from an existing version string.
 * If no previous version exists, starts at "0.1.0".
 */
function nextPatchVersion(currentVersion: string | null): string {
  if (!currentVersion) {
    return "0.1.0";
  }
  const next = semver.inc(currentVersion, "patch");
  return next ?? "0.1.0";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new version of an agent with auto-incremented semver patch.
 * The new version is linked to the previous latest version as its parent.
 */
export async function createVersion(
  agentId: string,
  definition: StoredAgentDefinition,
  changelog?: string
): Promise<AgentVersion> {
  const latest = await getLatestVersion(agentId);
  const parentId = latest?.id ?? null;
  const version = nextPatchVersion(latest?.version ?? null);
  const definitionJson = serializeDefinition(definition);

  const created = await db.agentVersion.create({
    data: {
      agentId,
      version,
      definition: definitionJson,
      changelog: changelog ?? "",
      parentId,
    },
  });

  // Update the agent's updatedAt timestamp
  await db.agent.update({
    where: { id: agentId },
    data: { updatedAt: new Date() },
  });

  return rawToAgentVersion(created);
}

/**
 * Get the full version history for an agent, sorted newest first.
 */
export async function getVersionHistory(agentId: string): Promise<AgentVersion[]> {
  const versions = await db.agentVersion.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });

  return versions.map(rawToAgentVersion);
}

/**
 * Get the most recent version for an agent.
 * Returns null if the agent has no versions.
 */
export async function getLatestVersion(agentId: string): Promise<AgentVersion | null> {
  const version = await db.agentVersion.findFirst({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });

  return version ? rawToAgentVersion(version) : null;
}

/**
 * Compute a structured diff between two versions.
 * Returns an array of diff entries describing what changed.
 */
export async function diffVersions(
  v1Id: string,
  v2Id: string
): Promise<VersionDiffEntry[]> {
  const [v1, v2] = await Promise.all([
    db.agentVersion.findUniqueOrThrow({ where: { id: v1Id } }),
    db.agentVersion.findUniqueOrThrow({ where: { id: v2Id } }),
  ]);

  const def1 = deserializeDefinition(v1.definition);
  const def2 = deserializeDefinition(v2.definition);

  const differences = deepDiff(def1, def2);

  if (!differences) {
    return [];
  }

  return differences.map((d) => {
    const entry: VersionDiffEntry = {
      kind: d.kind,
      path: (d.path ?? []).map(String),
    };

    if ("lhs" in d) entry.lhs = d.lhs;
    if ("rhs" in d) entry.rhs = d.rhs;
    if (d.kind === "A") {
      entry.index = d.index;
      if (d.item) {
        entry.item = {
          kind: d.item.kind,
          lhs: "lhs" in d.item ? d.item.lhs : undefined,
          rhs: "rhs" in d.item ? d.item.rhs : undefined,
        };
      }
    }

    return entry;
  });
}

/**
 * Rollback an agent to a previous version by creating a new version
 * that copies the definition from the target version.
 */
export async function rollbackToVersion(
  agentId: string,
  versionId: string
): Promise<AgentVersion> {
  const targetVersion = await db.agentVersion.findUniqueOrThrow({
    where: { id: versionId },
  });

  if (targetVersion.agentId !== agentId) {
    throw new Error(
      `Version ${versionId} does not belong to agent ${agentId}`
    );
  }

  const definition = deserializeDefinition(targetVersion.definition);
  const changelog = `Rollback to version ${targetVersion.version}`;

  return createVersion(agentId, definition, changelog);
}

/**
 * Set a tag (e.g. "stable", "beta") on a specific version.
 * Pass null to remove an existing tag.
 */
export async function tagVersion(
  versionId: string,
  tag: string | null
): Promise<AgentVersion> {
  const updated = await db.agentVersion.update({
    where: { id: versionId },
    data: { tag },
  });

  return rawToAgentVersion(updated);
}
