"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bot, Plus, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentItem {
  id: string;
  name: string;
  description: string;
  status: string;
  latestVersion?: { version: string };
  updatedAt: string;
}

const statusVariant: Record<string, "default" | "success" | "secondary"> = {
  draft: "secondary",
  active: "success",
  archived: "default",
};

const statusGlow: Record<string, string> = {
  active: "bg-emerald-500",
  draft: "bg-amber-500",
  archived: "bg-muted-foreground",
};

export function AgentStatusGrid() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(Array.isArray(data) ? data : []);
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">Agent Status</h2>
        <Link
          href="/agents"
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          View all agents
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children",
        loading && "animate-pulse"
      )}>
        {agents.map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`}>
            <div className={cn(
              "group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card p-5",
              "transition-all duration-300 ease-out-expo cursor-pointer",
              "hover:-translate-y-1 hover:shadow-premium-lg hover:border-[hsl(var(--primary)/0.2)]",
              "animate-fade-in-up"
            )}>
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--gradient-start)/0.03)] to-[hsl(var(--gradient-end)/0.03)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-white transition-transform duration-300 ease-out-expo group-hover:scale-105">
                      <Bot className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground/70">
                        {agent.latestVersion?.version || "v0.1.0"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Animated status dot */}
                    <div className="relative flex h-2 w-2">
                      {agent.status === "active" && (
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      )}
                      <span className={cn("relative inline-flex h-2 w-2 rounded-full", statusGlow[agent.status] || "bg-muted-foreground")} />
                    </div>
                    <Badge variant={statusVariant[agent.status] || "secondary"} className="text-[10px]">
                      {agent.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {agent.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {/* Create Agent Card */}
        <Link href="/agents/new">
          <div className={cn(
            "group relative flex h-full min-h-[160px] flex-col items-center justify-center gap-3 p-5",
            "rounded-2xl border border-dashed border-border/50",
            "transition-all duration-300 ease-out-expo cursor-pointer",
            "hover:-translate-y-1 hover:shadow-premium hover:border-primary/30",
            "animate-fade-in-up"
          )}>
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-[hsl(var(--gradient-start)/0.1)] to-[hsl(var(--gradient-end)/0.1)]",
              "transition-all duration-300 ease-out-expo group-hover:scale-110 group-hover:shadow-glow"
            )}>
              <Plus className="h-5 w-5 text-primary transition-transform duration-300 group-hover:rotate-90" />
            </div>
            <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
              Create Agent
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
