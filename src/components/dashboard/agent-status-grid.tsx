"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bot, Plus, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Agent Status</h2>
        <Link
          href="/agents"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all agents
        </Link>
      </div>
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", loading && "animate-pulse")}>
        {agents.map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/20 cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {agent.latestVersion?.version || "v0.1.0"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[agent.status] || "secondary"} className="shrink-0 text-[10px]">
                    {agent.status}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {agent.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Create Agent Card */}
        <Link href="/agents/new">
          <Card className="h-full border-dashed transition-all hover:shadow-md hover:border-primary/40 cursor-pointer">
            <CardContent className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Create Agent
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
