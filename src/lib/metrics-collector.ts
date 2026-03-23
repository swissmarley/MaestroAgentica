import { db } from "@/lib/db";
import { calculateCost } from "@/lib/cost-calculator";
import type { AgentMetrics } from "@/types/agent";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecordMetricInput {
  agentId: string;
  responseTime: number;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  success: boolean;
  numTurns?: number;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalRuns: number;
  successRate: number;
  totalCostUsd: number;
  avgResponseTime: number;
  recentRuns: Array<{
    id: string;
    agentId: string;
    agentName: string;
    success: boolean;
    responseTime: number;
    costUsd: number;
    timestamp: Date;
  }>;
  costByModel: Record<string, number>;
}

export type MetricPeriod = "1h" | "24h" | "7d" | "30d" | "all";

export interface AggregatedMetrics {
  period: MetricPeriod;
  totalRuns: number;
  successRate: number;
  avgResponseTime: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  dataPoints: Array<{
    timestamp: Date;
    responseTime: number;
    costUsd: number;
    success: boolean;
    inputTokens: number;
    outputTokens: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodToDate(period: MetricPeriod): Date | null {
  if (period === "all") return null;

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
  }
}

function groupByHour(
  metrics: Array<{ timestamp: Date }>
): { hour: string; count: number }[] {
  const groups: Record<string, number> = {};
  for (const m of metrics) {
    const hour = m.timestamp.toISOString().slice(0, 13) + ":00:00Z";
    groups[hour] = (groups[hour] ?? 0) + 1;
  }
  return Object.entries(groups)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Record a performance metric for an agent run.
 * Automatically calculates cost from token counts and model.
 */
export async function recordMetric(data: RecordMetricInput): Promise<string> {
  const costUsd = calculateCost(data.modelUsed, data.inputTokens, data.outputTokens);

  const metric = await db.performanceMetric.create({
    data: {
      agentId: data.agentId,
      responseTime: data.responseTime,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalCostUsd: costUsd,
      success: data.success,
      modelUsed: data.modelUsed,
      numTurns: data.numTurns ?? 1,
      metadata: data.metadata ? JSON.stringify(data.metadata) : "{}",
    },
  });

  return metric.id;
}

/**
 * Get aggregated metrics for an agent within a given time period.
 */
export async function getMetrics(
  agentId: string,
  period: MetricPeriod
): Promise<AggregatedMetrics> {
  const since = periodToDate(period);

  const where: Record<string, unknown> = { agentId };
  if (since) {
    where.timestamp = { gte: since };
  }

  const metrics = await db.performanceMetric.findMany({
    where,
    orderBy: { timestamp: "asc" },
  });

  const totalRuns = metrics.length;
  const successfulRuns = metrics.filter((m) => m.success).length;
  const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;
  const avgResponseTime =
    totalRuns > 0
      ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRuns
      : 0;
  const totalCostUsd = metrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
  const totalInputTokens = metrics.reduce((sum, m) => sum + m.inputTokens, 0);
  const totalOutputTokens = metrics.reduce((sum, m) => sum + m.outputTokens, 0);

  const dataPoints = metrics.map((m) => ({
    timestamp: m.timestamp,
    responseTime: m.responseTime,
    costUsd: m.totalCostUsd,
    success: m.success,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
  }));

  return {
    period,
    totalRuns,
    successRate,
    avgResponseTime,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    dataPoints,
  };
}

/**
 * Get summary statistics for a specific agent, matching the AgentMetrics interface.
 */
export async function getAgentStats(agentId: string): Promise<AgentMetrics> {
  const metrics = await db.performanceMetric.findMany({
    where: { agentId },
  });

  const totalRequests = metrics.length;
  const successfulRuns = metrics.filter((m) => m.success).length;
  const successRate = totalRequests > 0 ? successfulRuns / totalRequests : 0;
  const avgResponseTime =
    totalRequests > 0
      ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
      : 0;
  const totalTokens = metrics.reduce(
    (sum, m) => sum + m.inputTokens + m.outputTokens,
    0
  );
  const totalCost = metrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
  const avgTurns =
    totalRequests > 0
      ? metrics.reduce((sum, m) => sum + m.numTurns, 0) / totalRequests
      : 0;
  const requestsByHour = groupByHour(metrics);

  return {
    totalRequests,
    successRate,
    avgResponseTime,
    totalTokens,
    totalCost,
    avgTurns,
    requestsByHour,
  };
}

/**
 * Get global dashboard statistics across all agents.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [agentCount, activeAgentCount, allMetrics, recentMetrics] =
    await Promise.all([
      db.agent.count(),
      db.agent.count({ where: { status: "active" } }),
      db.performanceMetric.findMany(),
      db.performanceMetric.findMany({
        take: 20,
        orderBy: { timestamp: "desc" },
        include: { agent: { select: { name: true } } },
      }),
    ]);

  const totalRuns = allMetrics.length;
  const successfulRuns = allMetrics.filter((m) => m.success).length;
  const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;
  const totalCostUsd = allMetrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
  const avgResponseTime =
    totalRuns > 0
      ? allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRuns
      : 0;

  const costByModel: Record<string, number> = {};
  for (const m of allMetrics) {
    costByModel[m.modelUsed] = (costByModel[m.modelUsed] ?? 0) + m.totalCostUsd;
  }

  const recentRuns = recentMetrics.map((m) => ({
    id: m.id,
    agentId: m.agentId,
    agentName: (m as unknown as { agent: { name: string } }).agent.name,
    success: m.success,
    responseTime: m.responseTime,
    costUsd: m.totalCostUsd,
    timestamp: m.timestamp,
  }));

  return {
    totalAgents: agentCount,
    activeAgents: activeAgentCount,
    totalRuns,
    successRate,
    totalCostUsd,
    avgResponseTime,
    recentRuns,
    costByModel,
  };
}
