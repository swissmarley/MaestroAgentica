"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Search, X, ArrowDownToLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  metadata: string;
  timestamp: string;
}

const levelColors: Record<string, string> = {
  debug: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function LogsPage() {
  const params = useParams();
  const id = params.id as string;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadLogs() {
    try {
      const p = new URLSearchParams();
      if (level !== "all") p.set("level", level);
      if (search) p.set("search", search);
      p.set("limit", "100");

      const res = await fetch(`/api/agents/${id}/logs?${p}`);
      if (res.ok) {
        const data = await res.json();
        const entries = Array.isArray(data) ? data : (data?.logs ?? []);
        setLogs(entries);
      }
    } catch {
      // network error
    }
  }

  useEffect(() => {
    loadLogs();
  }, [id, level, search]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoScroll) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoScroll, id, level, search]);

  const filteredLogs = logs.filter((log) => {
    if (level !== "all" && log.level !== level) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 h-[calc(100vh-1px)]">
      <h2 className="text-lg font-semibold">Logs</h2>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-8 h-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-2"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="autoscroll" className="text-sm">
            Auto-scroll
          </Label>
          <Switch
            id="autoscroll"
            checked={autoScroll}
            onCheckedChange={setAutoScroll}
          />
        </div>
      </div>

      {/* Log entries */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <CardContent className="p-0">
            <div className="font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ArrowDownToLine className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No logs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Logs will appear here when the agent is deployed or tested.
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="group">
                    <button
                      className="flex items-start gap-2 px-3 py-1.5 hover:bg-muted/50 w-full text-left border-b border-border/50"
                      onClick={() =>
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                    >
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase shrink-0 ${
                          levelColors[log.level] || levelColors.info
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-foreground break-all">
                        {log.message}
                      </span>
                    </button>
                    {expandedLog === log.id && log.metadata && log.metadata !== "{}" && (
                      <div className="px-3 py-2 bg-muted/30 border-b">
                        <pre className="text-[10px] text-muted-foreground">
                          {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}
