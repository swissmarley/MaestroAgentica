"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatInterface } from "@/components/playground/chat-interface";

interface AgentVersion {
  id: string;
  version: string;
  tag?: string;
}

export default function PlaygroundPage() {
  const params = useParams();
  const id = params.id as string;
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.versions?.length > 0) {
            setVersions(data.versions);
            setSelectedVersion(data.versions[0].id);
          }
        }
      } catch {
        // fallback
      }
    }
    load();
  }, [id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 lg:px-8 py-2 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Live Testing</Badge>
        </div>
        {versions.length > 1 && (
          <Select
            value={selectedVersion}
            onValueChange={setSelectedVersion}
          >
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.version}
                  {v.tag && ` (${v.tag})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatInterface agentId={id} versionId={selectedVersion} />
      </div>
    </div>
  );
}
