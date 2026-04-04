import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await db.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "24h";
    const periodStart = getPeriodStart(period);

    const metrics = await db.performanceMetric.findMany({
      where: {
        agentId: id,
        timestamp: { gte: periodStart },
      },
      orderBy: { timestamp: "asc" },
    });

    const totalRequests = metrics.length;
    const successCount = metrics.filter((m) => m.success).length;
    const successRate = totalRequests > 0
      ? Math.round((successCount / totalRequests) * 10000) / 100
      : 0;
    const avgResponseTime = totalRequests > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests)
      : 0;
    const totalTokens = metrics.reduce(
      (sum, m) => sum + m.inputTokens + m.outputTokens,
      0
    );
    const totalCost = Math.round(
      metrics.reduce((sum, m) => sum + m.totalCostUsd, 0) * 10000
    ) / 10000;

    // Build timeline grouped by hour
    const hourMap: Record<string, {
      responseTime: number[];
      inputTokens: number;
      outputTokens: number;
      cost: number;
      requests: number;
    }> = {};

    for (const m of metrics) {
      const hour = new Date(m.timestamp).toISOString().slice(11, 13) + ":00";
      if (!hourMap[hour]) {
        hourMap[hour] = { responseTime: [], inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
      }
      hourMap[hour].responseTime.push(m.responseTime);
      hourMap[hour].inputTokens += m.inputTokens;
      hourMap[hour].outputTokens += m.outputTokens;
      hourMap[hour].cost += m.totalCostUsd;
      hourMap[hour].requests += 1;
    }

    const timeline = Object.entries(hourMap).map(([time, data]) => ({
      time,
      responseTime: Math.round(data.responseTime.reduce((a, b) => a + b, 0) / data.responseTime.length),
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost: Math.round(data.cost * 10000) / 10000,
      requests: data.requests,
    }));

    return NextResponse.json({
      summary: {
        totalRequests,
        successRate,
        avgResponseTime,
        totalTokens,
        totalCost,
      },
      timeline,
    });
  } catch (err) {
    console.error(`GET /api/agents/${id}/metrics error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
