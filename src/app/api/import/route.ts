import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let importData: {
      manifest?: {
        name?: string;
        description?: string;
        version?: string;
        tags?: string[];
        integrations?: {
          tools?: Array<{ toolId: string; config?: Record<string, unknown> }>;
          skills?: Array<{ skillId: string }>;
          memory?: Array<{ collectionName: string; collectionDescription?: string; chromaId?: string }>;
        };
      };
      "agent-definition"?: Record<string, unknown>;
    };

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const text = await file.text();
      importData = JSON.parse(text);
    } else {
      importData = await request.json();
    }

    const manifest = importData.manifest;
    const definition = importData["agent-definition"];

    if (!manifest?.name) {
      return NextResponse.json(
        { error: "Invalid package: missing manifest.name" },
        { status: 400 }
      );
    }

    // Create the agent with version
    const agent = await db.agent.create({
      data: {
        name: manifest.name,
        description: manifest.description || "",
        status: "draft",
        tags: JSON.stringify(manifest.tags || []),
        versions: {
          create: {
            version: manifest.version || "0.1.0",
            definition: JSON.stringify(definition || {}),
            changelog: "Imported from package",
          },
        },
      },
      include: { versions: true },
    });

    // Restore integrations if present
    const integrations = manifest.integrations;
    if (integrations) {
      // Restore tool assignments
      if (integrations.tools && integrations.tools.length > 0) {
        for (const tool of integrations.tools) {
          if (tool.toolId) {
            await db.agentTool.create({
              data: {
                agentId: agent.id,
                toolId: tool.toolId,
                config: JSON.stringify(tool.config || {}),
              },
            });
          }
        }
      }

      // Restore skill assignments
      if (integrations.skills && integrations.skills.length > 0) {
        for (const skill of integrations.skills) {
          if (skill.skillId) {
            await db.agentSkill.create({
              data: {
                agentId: agent.id,
                skillId: skill.skillId,
              },
            });
          }
        }
      }

      // Restore memory collection links (link to existing collections by name if they exist)
      if (integrations.memory && integrations.memory.length > 0) {
        for (const mem of integrations.memory) {
          if (mem.collectionName) {
            // Try to find an existing collection with the same name
            const existing = await db.memoryCollection.findFirst({
              where: { name: mem.collectionName },
            });
            if (existing) {
              await db.agentMemory.upsert({
                where: {
                  agentId_collectionId: {
                    agentId: agent.id,
                    collectionId: existing.id,
                  },
                },
                create: {
                  agentId: agent.id,
                  collectionId: existing.id,
                },
                update: {},
              });
            }
            // If no matching collection exists, skip — user can attach manually
          }
        }
      }
    }

    // Re-fetch with all relations
    const fullAgent = await db.agent.findUnique({
      where: { id: agent.id },
      include: {
        versions: true,
        tools: true,
        skills: true,
        memories: {
          include: {
            collection: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });

    return NextResponse.json(fullAgent, { status: 201 });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import agent" },
      { status: 500 }
    );
  }
}
