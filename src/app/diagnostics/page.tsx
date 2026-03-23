"use client";

import { useState, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SkipForward,
  Loader2,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Send,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: unknown;
  durationMs: number;
}

interface DiagnosticSummary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  skip: number;
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", label: "Pass" },
  fail: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", label: "Fail" },
  warn: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", label: "Warning" },
  skip: { icon: SkipForward, color: "text-muted-foreground", bg: "bg-muted/50", label: "Skipped" },
};

const TOOL_OPTIONS = [
  { value: "read_file", label: "Read File" },
  { value: "write_file", label: "Write File" },
  { value: "list_directory", label: "List Directory" },
  { value: "create_directory", label: "Create Directory" },
  { value: "move_file", label: "Move File" },
  { value: "search_files", label: "Search Files" },
  { value: "memory_query", label: "Memory Query" },
  { value: "memory_store", label: "Memory Store" },
  { value: "memory_list_collections", label: "Memory List Collections" },
];

const TOOL_INPUT_HINTS: Record<string, string> = {
  read_file: '{ "path": "diagnostics-test/hello.txt" }',
  write_file: '{ "path": "test-output/example.txt", "content": "Hello from diagnostic tool test!" }',
  list_directory: '{ "path": "/" }',
  create_directory: '{ "path": "test-output/new-folder" }',
  move_file: '{ "source": "test-output/example.txt", "destination": "test-output/moved.txt" }',
  search_files: '{ "pattern": ".txt", "path": "/" }',
  memory_query: '{ "query": "test query" }',
  memory_store: '{ "collection_id": "your-collection-id", "content": "Test memory entry" }',
  memory_list_collections: "{}",
};

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Tool test state
  const [selectedTool, setSelectedTool] = useState("read_file");
  const [toolInput, setToolInput] = useState(TOOL_INPUT_HINTS["read_file"]);
  const [toolResult, setToolResult] = useState<{ output: string; isError: boolean } | null>(null);
  const [isTestingTool, setIsTestingTool] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setResults(null);
    setSummary(null);
    setExpandedItems(new Set());

    try {
      const res = await fetch("/api/diagnostics");
      const data = await res.json();
      setResults(data.results);
      setSummary(data.summary);

      // Auto-expand failures
      const failedIndices = new Set<number>();
      data.results.forEach((r: DiagnosticResult, i: number) => {
        if (r.status === "fail" || r.status === "warn") failedIndices.add(i);
      });
      setExpandedItems(failedIndices);
    } catch (err) {
      setResults([{
        name: "Diagnostics API",
        status: "fail",
        message: err instanceof Error ? err.message : "Failed to run diagnostics",
        durationMs: 0,
      }]);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const testTool = useCallback(async () => {
    setIsTestingTool(true);
    setToolResult(null);

    try {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(toolInput);
      } catch {
        setToolResult({ output: "Invalid JSON input", isError: true });
        return;
      }

      const res = await fetch("/api/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: selectedTool, input: parsedInput }),
      });
      const data = await res.json();
      setToolResult(data);
    } catch (err) {
      setToolResult({
        output: err instanceof Error ? err.message : "Request failed",
        isError: true,
      });
    } finally {
      setIsTestingTool(false);
    }
  }, [selectedTool, toolInput]);

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Header
        title="System Diagnostics"
        description="Verify tools, skills, memory, and agent integrations are working"
      >
        <Button variant="outline" asChild>
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </Header>

      {/* Run diagnostics button */}
      <div className="flex items-center gap-4">
        <Button onClick={runDiagnostics} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Checks...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run All Diagnostics
            </>
          )}
        </Button>
        {results && (
          <Button variant="outline" onClick={runDiagnostics} disabled={isRunning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-run
          </Button>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryCard label="Passed" count={summary.pass} total={summary.total} variant="pass" />
          <SummaryCard label="Failed" count={summary.fail} total={summary.total} variant="fail" />
          <SummaryCard label="Warnings" count={summary.warn} total={summary.total} variant="warn" />
          <SummaryCard label="Skipped" count={summary.skip} total={summary.total} variant="skip" />
        </div>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Check Results ({results.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((result, i) => {
              const config = STATUS_CONFIG[result.status];
              const Icon = config.icon;
              const expanded = expandedItems.has(i);

              return (
                <div key={i} className={cn("rounded-lg border", config.bg)}>
                  <button
                    onClick={() => toggleExpand(i)}
                    className="flex items-center justify-between w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                      <div>
                        <p className="text-sm font-medium">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {result.durationMs}ms
                      </Badge>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {expanded && result.details != null && (
                    <div className="px-4 pb-3">
                      <pre className="text-xs bg-background/80 rounded p-3 overflow-auto max-h-48 border">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tool tester */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Tool Tester
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Test individual tools directly to verify they work correctly.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tool</Label>
              <Select
                value={selectedTool}
                onValueChange={(v) => {
                  setSelectedTool(v);
                  setToolInput(TOOL_INPUT_HINTS[v] || "{}");
                  setToolResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Input (JSON)</Label>
              <Input
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                className="font-mono text-sm"
                placeholder="{}"
              />
            </div>
          </div>
          <Button onClick={testTool} disabled={isTestingTool}>
            {isTestingTool ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Execute Tool
              </>
            )}
          </Button>
          {toolResult && (
            <div className={cn(
              "rounded-lg border p-4",
              toolResult.isError
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {toolResult.isError ? (
                  <XCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <span className="text-sm font-medium">
                  {toolResult.isError ? "Error" : "Success"}
                </span>
              </div>
              <pre className="text-xs bg-background/80 rounded p-3 overflow-auto max-h-48 border whitespace-pre-wrap">
                {formatOutput(toolResult.output)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  total,
  variant,
}: {
  label: string;
  count: number;
  total: number;
  variant: "pass" | "fail" | "warn" | "skip";
}) {
  const config = STATUS_CONFIG[variant];
  const Icon = config.icon;
  return (
    <Card className={cn(count > 0 && config.bg)}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {count}<span className="text-sm font-normal text-muted-foreground">/{total}</span>
            </p>
          </div>
          <Icon className={cn("h-8 w-8", config.color)} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatOutput(output: string): string {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
}
