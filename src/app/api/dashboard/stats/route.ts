import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get agent counts
    const agents = await db.agent.findMany({
      select: { id: true, status: true },
    });
    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === "active").length;

    // Get all metrics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const metrics = await db.performanceMetric.findMany({
      where: { timestamp: { gte: thirtyDaysAgo } },
      orderBy: { timestamp: "asc" },
    });

    const totalRuns = metrics.length;
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const successRate = totalRuns > 0
      ? Math.round((metrics.filter((m) => m.success).length / totalRuns) * 100)
      : 0;
    const avgResponseTime = totalRuns > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRuns)
      : 0;

    // Build daily timeline for chart (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentMetrics = metrics.filter((m) => m.timestamp >= fourteenDaysAgo);

    const dayMap: Record<string, {
      runs: number;
      tokens: number;
      cost: number;
      inputTokens: number;
      outputTokens: number;
    }> = {};

    // Initialize all 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { runs: 0, tokens: 0, cost: 0, inputTokens: 0, outputTokens: 0 };
    }

    for (const m of recentMetrics) {
      const key = m.timestamp.toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].runs += 1;
        dayMap[key].tokens += m.inputTokens + m.outputTokens;
        dayMap[key].cost += m.totalCostUsd;
        dayMap[key].inputTokens += m.inputTokens;
        dayMap[key].outputTokens += m.outputTokens;
      }
    }

    const timeline = Object.entries(dayMap).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      runs: data.runs,
      tokens: data.tokens,
      cost: Math.round(data.cost * 10000) / 10000,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
    }));

    // Get memory and integration counts
    const memoryCollections = await db.memoryCollection.count();
    const toolAssignments = await db.agentTool.count();
    const skillAssignments = await db.agentSkill.count();

    return NextResponse.json({
      cards: {
        totalAgents,
        activeAgents,
        totalRuns,
        totalCost: Math.round(totalCost * 100) / 100,
        totalTokens,
        successRate,
        avgResponseTime,
        memoryCollections,
        toolAssignments,
        skillAssignments,
      },
      timeline,
    });
  } catch (err) {
    console.error("GET /api/dashboard/stats error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
