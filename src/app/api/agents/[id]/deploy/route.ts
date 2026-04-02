import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deployments = await db.deployment.findMany({
      where: { agentId: id },
      include: {
        version: { select: { version: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = deployments.map((d) => ({
      id: d.id,
      agentId: d.agentId,
      versionId: d.versionId,
      environment: d.environment,
      status: d.status,
      config: JSON.parse(d.config),
      version: d.version.version,
      healthCheck: d.healthCheck ? JSON.parse(d.healthCheck) : null,
      startedAt: d.startedAt?.toISOString() || null,
      stoppedAt: d.stoppedAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
    }));

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("GET deploy error:", err);
    return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { environment, versionId, config } = body as {
      environment?: string;
      versionId?: string;
      config?: Record<string, string>;
    };

    if (!environment || !["dev", "staging", "prod"].includes(environment)) {
      return NextResponse.json(
        { error: "Valid environment required (dev, staging, prod)" },
        { status: 400 }
      );
    }

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        versions: versionId
          ? { where: { id: versionId } }
          : { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const version = agent.versions[0];
    if (!version) {
      return NextResponse.json({ error: "No version available" }, { status: 400 });
    }

    // Upsert deployment (one per agent + environment)
    const deployment = await db.deployment.upsert({
      where: {
        agentId_environment: {
          agentId: id,
          environment,
        },
      },
      create: {
        agentId: id,
        versionId: version.id,
        environment,
        status: "running",
        config: JSON.stringify(config || {}),
        startedAt: new Date(),
      },
      update: {
        versionId: version.id,
        status: "running",
        config: JSON.stringify(config || {}),
        startedAt: new Date(),
        stoppedAt: null,
      },
      include: {
        version: { select: { version: true } },
      },
    });

    // Set agent status to active when deployed
    await db.agent.update({
      where: { id },
      data: { status: "active" },
    });

    // Log the deployment
    await db.logEntry.create({
      data: {
        agentId: id,
        deploymentId: deployment.id,
        level: "info",
        message: `Deployed ${deployment.version.version} to ${environment}`,
      },
    });

    return NextResponse.json({
      id: deployment.id,
      environment: deployment.environment,
      status: deployment.status,
      version: deployment.version.version,
      startedAt: deployment.startedAt?.toISOString(),
    }, { status: 201 });
  } catch (err) {
    console.error("POST deploy error:", err);
    return NextResponse.json({ error: "Failed to deploy" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get("environment");

    if (!environment) {
      return NextResponse.json({ error: "Environment required" }, { status: 400 });
    }

    const deployment = await db.deployment.findUnique({
      where: {
        agentId_environment: {
          agentId: id,
          environment,
        },
      },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    await db.deployment.update({
      where: { id: deployment.id },
      data: {
        status: "stopped",
        stoppedAt: new Date(),
      },
    });

    // Check if any deployments are still running
    const runningCount = await db.deployment.count({
      where: {
        agentId: id,
        status: "running",
        id: { not: deployment.id },
      },
    });

    // If no deployments running, set agent back to draft
    if (runningCount === 0) {
      await db.agent.update({
        where: { id },
        data: { status: "draft" },
      });
    }

    await db.logEntry.create({
      data: {
        agentId: id,
        deploymentId: deployment.id,
        level: "info",
        message: `Stopped deployment in ${environment}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE deploy error:", err);
    return NextResponse.json({ error: "Failed to stop deployment" }, { status: 500 });
  }
}
