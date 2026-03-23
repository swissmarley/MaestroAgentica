"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bot, Rocket, FlaskConical, Plus, ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LogItem {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  agentId: string;
}

interface AgentMap {
  [id: string]: string;
}

function classifyAction(message: string): "deployed" | "tested" | "created" | "updated" {
  const lower = message.toLowerCase();
  if (lower.includes("deploy") || lower.includes("stopped")) return "deployed";
  if (lower.includes("test") || lower.includes("playground")) return "tested";
  if (lower.includes("creat")) return "created";
  return "updated";
}

const actionIcons = {
  tested: FlaskConical,
  deployed: Rocket,
  created: Plus,
  updated: Bot,
};

const actionColors = {
  tested: "text-purple-500",
  deployed: "text-emerald-500",
  created: "text-blue-500",
  updated: "text-amber-500",
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<
    Array<{
      id: string;
      agentName: string;
      action: "tested" | "deployed" | "created" | "updated";
      message: string;
      timestamp: Date;
      level: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        // Get agents to build name lookup
        const agentsRes = await fetch("/api/agents");
        const agents = agentsRes.ok ? await agentsRes.json() : [];
        const agentMap: AgentMap = {};
        if (Array.isArray(agents)) {
          for (const a of agents) {
            agentMap[a.id] = a.name;
          }
        }

        // Get recent logs across all agents
        const allLogs: LogItem[] = [];
        for (const a of Array.isArray(agents) ? agents : []) {
          try {
            const logRes = await fetch(`/api/agents/${a.id}/logs?limit=10`);
            if (logRes.ok) {
              const raw = await logRes.json();
              const logs = Array.isArray(raw) ? raw : (raw?.logs ?? []);
              if (logs.length > 0) {
                allLogs.push(...logs.map((l: LogItem) => ({ ...l, agentId: a.id })));
              }
            }
          } catch {
            // skip
          }
        }

        // Sort by timestamp desc and take top 10
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recent = allLogs.slice(0, 10);

        setActivities(
          recent.map((log) => ({
            id: log.id,
            agentName: agentMap[log.agentId] || "Unknown Agent",
            action: classifyAction(log.message),
            message: log.message,
            timestamp: new Date(log.timestamp),
            level: log.level,
          }))
        );
      } catch {
        // No data available
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        <Link
          href="/agents"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here when you deploy or test agents.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => {
              const Icon = actionIcons[activity.action];
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className={cn("shrink-0", actionColors[activity.action])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.agentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.message.length > 50
                        ? activity.message.slice(0, 50) + "..."
                        : activity.message}{" "}
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                  <Badge
                    variant={activity.level === "error" ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {activity.level}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
