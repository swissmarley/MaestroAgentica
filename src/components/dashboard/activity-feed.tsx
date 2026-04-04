"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bot, Rocket, FlaskConical, Plus, ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
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

const actionGradients = {
  tested: "from-violet-500 to-purple-600",
  deployed: "from-emerald-500 to-teal-600",
  created: "from-blue-500 to-indigo-600",
  updated: "from-amber-500 to-orange-600",
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
        const agentsRes = await fetch("/api/agents");
        const agents = agentsRes.ok ? await agentsRes.json() : [];
        const agentMap: AgentMap = {};
        if (Array.isArray(agents)) {
          for (const a of agents) {
            agentMap[a.id] = a.name;
          }
        }

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
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-fade-in-up transition-all duration-300 hover:shadow-premium">
      <div className="flex items-center justify-between p-6 pb-3">
        <h3 className="text-base font-semibold">Recent Activity</h3>
        <Link
          href="/agents"
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="px-6 pb-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mb-3">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Activity will appear here when you deploy or test agents.
            </p>
          </div>
        ) : (
          <div className="space-y-1 stagger-children">
            {activities.map((activity) => {
              const Icon = actionIcons[activity.action];
              return (
                <div
                  key={activity.id}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ease-out-expo hover:bg-[hsl(var(--foreground)/0.03)] animate-fade-in cursor-default"
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                    "transition-transform duration-200 ease-out-expo group-hover:scale-110",
                    actionGradients[activity.action]
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.agentName}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">
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
      </div>
    </div>
  );
}
