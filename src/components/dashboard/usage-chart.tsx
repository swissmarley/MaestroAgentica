"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { BarChart3 } from "lucide-react";

interface TimelinePoint {
  date: string;
  runs: number;
  tokens: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

export function UsageChart() {
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setTimeline(data.timeline || []);
          setHasData((data.timeline || []).some((p: TimelinePoint) => p.runs > 0));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-fade-in-up">
        <div className="p-6 pb-3">
          <h3 className="text-base font-semibold">Usage Overview</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[280px] animate-pulse rounded-xl bg-muted/50" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-fade-in-up">
        <div className="p-6 pb-3">
          <h3 className="text-base font-semibold">Usage Overview</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No usage data yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-[240px]">
              Charts will appear here as agents process requests.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 12,
    border: "none",
    background: "hsl(var(--card))",
    boxShadow: "0 4px 24px hsl(var(--foreground) / 0.1)",
    padding: "10px 14px",
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Runs Chart */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-fade-in-up transition-all duration-300 hover:shadow-premium">
        <div className="p-6 pb-3">
          <h3 className="text-base font-semibold">Agent Runs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(239, 84%, 67%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600, marginBottom: 4 }} cursor={{ fill: "hsl(var(--foreground) / 0.03)" }} />
                <Bar dataKey="runs" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Runs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Token Usage Chart */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-fade-in-up transition-all duration-300 hover:shadow-premium">
        <div className="p-6 pb-3">
          <h3 className="text-base font-semibold">Token Usage</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600, marginBottom: 4 }} cursor={{ stroke: "hsl(var(--foreground) / 0.1)" }} />
                <Area
                  type="monotone"
                  dataKey="inputTokens"
                  stackId="1"
                  stroke="hsl(239, 84%, 67%)"
                  strokeWidth={2}
                  fill="url(#inputGradient)"
                  name="Input Tokens"
                />
                <Area
                  type="monotone"
                  dataKey="outputTokens"
                  stackId="1"
                  stroke="hsl(262, 83%, 58%)"
                  strokeWidth={2}
                  fill="url(#outputGradient)"
                  name="Output Tokens"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
