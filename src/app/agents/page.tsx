"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Clock,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AgentListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  latestVersion?: {
    version: string;
  };
  createdAt: string;
  updatedAt: string;
}

const statusVariant: Record<string, "default" | "success" | "secondary" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "secondary",
  paused: "secondary",
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      setLoading(true);
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

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        !search ||
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        agent.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || agent.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [agents, search, statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Handle error
    }
  };

  const handleDuplicate = async (agent: AgentListItem) => {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${agent.name} (Copy)`,
          description: agent.description,
          definition: {
            model: "claude-sonnet-4-20250514",
            systemPrompt: "",
            tools: [],
            maxTurns: 1,
          },
        }),
      });
      if (res.ok) {
        fetchAgents();
      }
    } catch {
      // Handle error
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Header title="Agents" description="Manage your AI agents">
        <Button asChild variant="gradient">
          <Link href="/agents/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Link>
        </Button>
      </Header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted/50" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 rounded-lg bg-muted/50" />
                    <div className="h-3 w-16 rounded-lg bg-muted/50" />
                  </div>
                </div>
                <div className="h-8 rounded-lg bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card animate-fade-in-up">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--gradient-start)/0.1)] to-[hsl(var(--gradient-end)/0.1)] mb-4">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">
              {agents.length === 0 ? "No agents yet" : "No agents found"}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground text-center max-w-sm">
              {agents.length === 0
                ? "Get started by creating your first AI agent."
                : "Try adjusting your search or filter criteria."}
            </p>
            {agents.length === 0 && (
              <Button asChild variant="gradient" className="mt-5">
                <Link href="/agents/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 cursor-pointer",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-1 hover:shadow-premium-lg hover:border-[hsl(var(--primary)/0.2)]",
                "animate-fade-in-up"
              )}
              onClick={() => router.push(`/agents/${agent.id}`)}
            >
              {/* Gradient hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--gradient-start)/0.03)] to-[hsl(var(--gradient-end)/0.03)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-white transition-transform duration-300 ease-out group-hover:scale-105">
                      <Bot className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground/70">
                        {agent.latestVersion?.version || "v0.1.0"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={statusVariant[agent.status] || "secondary"} className="text-[10px]">
                      {agent.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => router.push(`/agents/${agent.id}`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(agent)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(agent.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {agent.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  <span>
                    Updated{" "}
                    {formatDistanceToNow(new Date(agent.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
