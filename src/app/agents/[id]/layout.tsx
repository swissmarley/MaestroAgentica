"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Trash2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentSubNav } from "@/components/agents/agent-sub-nav";

const statusVariant: Record<string, "default" | "success" | "secondary" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "secondary",
  paused: "secondary",
};

interface AgentInfo {
  id: string;
  name: string;
  status: string;
  latestVersion?: { version: string };
}

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [agent, setAgent] = useState<AgentInfo | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (res.ok) {
          const data = await res.json();
          setAgent(data);
        }
      } catch {
        // fallback
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/agents");
    } catch {
      // handle error
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setAgent(await res.json());
      }
    } catch {
      // handle error
    }
  };

  const version = agent?.latestVersion?.version || "";
  const versionDisplay = version ? (version.startsWith("v") ? version : `v${version}`) : "";

  return (
    <div className="flex flex-col h-full">
      {/* Agent header bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{agent?.name || "Loading..."}</h1>
            {agent?.status && (
              <Badge variant={statusVariant[agent.status] || "secondary"}>
                {agent.status}
              </Badge>
            )}
            {versionDisplay && (
              <span className="text-sm text-muted-foreground">{versionDisplay}</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleStatusChange("active")}>
              Set Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("paused")}>
              Pause
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("archived")}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sub-navigation tabs */}
      <AgentSubNav agentId={id} />

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
