"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Tag, RotateCcw, GitCompare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Version {
  id: string;
  version: string;
  changelog: string;
  tag: string | null;
  createdAt: string;
  definition: Record<string, unknown> | string;
}

export default function VersionsPage() {
  const params = useParams();
  const id = params.id as string;
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [creating, setCreating] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffVersions, setDiffVersions] = useState<[Version | null, Version | null]>([null, null]);
  const [rolling, setRolling] = useState<string | null>(null);

  function getDefinitionObj(v: Version): Record<string, unknown> {
    if (typeof v.definition === "string") {
      try { return JSON.parse(v.definition); } catch { return {}; }
    }
    return v.definition || {};
  }

  async function loadVersions() {
    try {
      const res = await fetch(`/api/agents/${id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVersions();
  }, [id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const latestDef = versions[0] ? getDefinitionObj(versions[0]) : {};
      const res = await fetch(`/api/agents/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: latestDef, changelog }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setChangelog("");
        loadVersions();
      }
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  };

  const handleRollback = async (targetVersion: Version) => {
    if (!confirm(`Rollback to ${targetVersion.version}? This will create a new version with that configuration.`)) return;
    setRolling(targetVersion.id);
    try {
      const def = getDefinitionObj(targetVersion);
      const res = await fetch(`/api/agents/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: def,
          changelog: `Rollback to ${targetVersion.version}`,
        }),
      });
      if (res.ok) {
        loadVersions();
      }
    } catch {
      // handle error
    } finally {
      setRolling(null);
    }
  };

  const handleDiff = (v1: Version, v2: Version) => {
    setDiffVersions([v1, v2]);
    setDiffOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Version History</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Version
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : versions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No versions yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first version snapshot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-border" />

          <div className="space-y-4">
            {versions.map((v, i) => (
              <div key={v.id} className="flex gap-4 relative">
                {/* Timeline dot */}
                <div className="relative z-10 mt-3">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                    i === 0
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`} />
                </div>

                {/* Version card */}
                <Card className="flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {v.version}
                        </span>
                        {i === 0 && (
                          <Badge variant="success">Latest</Badge>
                        )}
                        {v.tag && (
                          <Badge variant="outline">
                            <Tag className="h-3 w-3 mr-1" />
                            {v.tag}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(v.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {v.changelog && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {v.changelog}
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-3">
                      {i > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={rolling === v.id}
                          onClick={() => handleRollback(v)}
                        >
                          <RotateCcw className={`h-3 w-3 mr-1 ${rolling === v.id ? "animate-spin" : ""}`} />
                          {rolling === v.id ? "Rolling back..." : "Rollback"}
                        </Button>
                      )}
                      {i < versions.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleDiff(versions[i + 1], v)}
                        >
                          <GitCompare className="h-3 w-3 mr-1" />
                          Compare
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Version Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Changelog</Label>
              <Textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="What changed in this version?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Compare {diffVersions[0]?.version} → {diffVersions[1]?.version}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {diffVersions[0]?.version} (Old)
              </div>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap">
                {diffVersions[0]
                  ? JSON.stringify(getDefinitionObj(diffVersions[0]), null, 2)
                  : ""}
              </pre>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {diffVersions[1]?.version} (New)
              </div>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap">
                {diffVersions[1]
                  ? JSON.stringify(getDefinitionObj(diffVersions[1]), null, 2)
                  : ""}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
