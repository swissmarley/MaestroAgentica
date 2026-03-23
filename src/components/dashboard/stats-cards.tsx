"use client";

import { useEffect, useState } from "react";
import { Bot, Rocket, Play, DollarSign, Zap, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatCard[]>([
    {
      label: "Total Agents",
      value: "0",
      icon: Bot,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/50",
    },
    {
      label: "Active Agents",
      value: "0",
      icon: Rocket,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/50",
    },
    {
      label: "Total Runs",
      value: "0",
      subLabel: "Last 30 days",
      icon: Play,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/50",
    },
    {
      label: "Total Cost",
      value: "$0.00",
      subLabel: "Last 30 days",
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/50",
    },
    {
      label: "Total Tokens",
      value: "0",
      icon: Zap,
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/50",
    },
    {
      label: "Memory Collections",
      value: "0",
      icon: Brain,
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-100 dark:bg-pink-900/50",
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          const c = data.cards;

          const formatTokens = (n: number) => {
            if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
            if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
            return n.toString();
          };

          setStats((prev) => [
            { ...prev[0], value: c.totalAgents.toString() },
            { ...prev[1], value: c.activeAgents.toString() },
            { ...prev[2], value: c.totalRuns.toString(), subLabel: c.successRate > 0 ? `${c.successRate}% success rate` : "Last 30 days" },
            { ...prev[3], value: `$${c.totalCost.toFixed(2)}`, subLabel: c.avgResponseTime > 0 ? `~${c.avgResponseTime}ms avg` : "Last 30 days" },
            { ...prev[4], value: formatTokens(c.totalTokens) },
            { ...prev[5], value: c.memoryCollections.toString() },
          ]);
        }
      } catch {
        // Keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={cn(
            "transition-shadow hover:shadow-md",
            loading && "animate-pulse"
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                {stat.subLabel && (
                  <p className="text-[10px] text-muted-foreground">{stat.subLabel}</p>
                )}
              </div>
              <div className={cn("rounded-lg p-2", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
