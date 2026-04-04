"use client";

import { useEffect, useState } from "react";
import { Bot, Rocket, Play, DollarSign, Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatCard[]>([
    {
      label: "Total Agents",
      value: "0",
      icon: Bot,
      gradient: "from-blue-500 to-indigo-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(239_84%_67%/0.2)]",
    },
    {
      label: "Active Agents",
      value: "0",
      icon: Rocket,
      gradient: "from-emerald-500 to-teal-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(160_84%_45%/0.2)]",
    },
    {
      label: "Total Runs",
      value: "0",
      subLabel: "Last 30 days",
      icon: Play,
      gradient: "from-violet-500 to-purple-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(262_83%_58%/0.2)]",
    },
    {
      label: "Total Cost",
      value: "$0.00",
      subLabel: "Last 30 days",
      icon: DollarSign,
      gradient: "from-amber-500 to-orange-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(38_92%_50%/0.2)]",
    },
    {
      label: "Total Tokens",
      value: "0",
      icon: Zap,
      gradient: "from-cyan-500 to-blue-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(190_84%_50%/0.2)]",
    },
    {
      label: "Memory Collections",
      value: "0",
      icon: Brain,
      gradient: "from-pink-500 to-rose-600",
      glowColor: "group-hover:shadow-[0_0_30px_hsl(340_82%_52%/0.2)]",
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 stagger-children">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5",
            "transition-all duration-300 ease-out-expo cursor-default",
            "hover:-translate-y-1 hover:shadow-premium-lg",
            stat.glowColor,
            loading ? "animate-pulse" : "animate-fade-in-up"
          )}
        >
          {/* Subtle gradient overlay on hover */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300",
            stat.gradient,
            "group-hover:opacity-[0.03]"
          )} />

          <div className="relative flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                {stat.label}
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {stat.value}
              </p>
              {stat.subLabel && (
                <p className="text-[11px] text-muted-foreground/70">{stat.subLabel}</p>
              )}
            </div>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white",
              "transition-transform duration-300 ease-out-expo group-hover:scale-110",
              stat.gradient
            )}>
              <stat.icon className="h-[18px] w-[18px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
