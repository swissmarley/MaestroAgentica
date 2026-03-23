"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ToolCallInfo } from "@/types/playground";

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-900", badge: "secondary" as const },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", badge: "default" as const },
  completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", badge: "success" as const },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", badge: "destructive" as const },
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[toolCall.status];
  const StatusIcon = config.icon;

  const duration =
    toolCall.completedAt && toolCall.startedAt
      ? `${((toolCall.completedAt - toolCall.startedAt) / 1000).toFixed(1)}s`
      : null;

  return (
    <div className={cn("rounded-lg border text-sm", config.bg)}>
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono font-medium">{toolCall.name}</span>
        <StatusIcon
          className={cn(
            "h-3.5 w-3.5 ml-auto shrink-0",
            config.color,
            toolCall.status === "running" && "animate-spin"
          )}
        />
        <Badge variant={config.badge} className="text-[10px] h-5">
          {toolCall.status}
        </Badge>
        {duration && (
          <span className="text-xs text-muted-foreground">{duration}</span>
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
            <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
              <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {toolCall.output.length > 2000
                  ? toolCall.output.slice(0, 2000) + "\n... (truncated)"
                  : toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
