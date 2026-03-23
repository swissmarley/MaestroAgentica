"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Save,
  Globe,
  Plus,
  Brain,
  Wrench,
  Sparkles,
  Link2,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AgentData {
  id: string;
  name: string;
  description: string;
  status: string;
  tags: string[];
  latestVersion?: {
    id: string;
    version: string;
    definition: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTurns?: number;
      webSearchEnabled?: boolean;
      tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
    };
  };
  memories?: Array<{
    id: string;
    collectionId: string;
    collection: { id: string; name: string; description: string; totalSize: number };
  }>;
  tools?: Array<{ id: string; agentId: string; toolId: string; config: string }>;
  skills?: Array<{ id: string; agentId: string; skillId: string }>;
}

interface MemoryCollectionOption {
  id: string;
  name: string;
  description: string;
  totalSize: number;
}

interface ToolOption {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tools: string[];
}

interface SkillOption {
  id: string;
  name: string;
  description: string;
  category: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: "claude-sonnet-4-6",
    temperature: "0.7",
    maxTurns: "1",
    webSearchEnabled: false,
  });

  // Memory state
  const [agentMemories, setAgentMemories] = useState<AgentData["memories"]>([]);
  const [allCollections, setAllCollections] = useState<MemoryCollectionOption[]>([]);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState("");

  // Tools state (per-agent)
  const [agentToolIds, setAgentToolIds] = useState<string[]>([]);
  const [allTools, setAllTools] = useState<ToolOption[]>([]);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState("");

  // Skills state (per-agent)
  const [agentSkillIds, setAgentSkillIds] = useState<string[]>([]);
  const [allSkills, setAllSkills] = useState<SkillOption[]>([]);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState("");

  useEffect(() => {
    fetchAgent();
    fetchCatalogData();
  }, [id]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (res.ok) {
        const data: AgentData = await res.json();
        setAgent(data);
        const def = data.latestVersion?.definition;
        setForm({
          name: data.name || "",
          description: data.description || "",
          systemPrompt: def?.systemPrompt || "",
          model: def?.model || "claude-sonnet-4-6",
          temperature: String(def?.temperature ?? 0.7),
          maxTurns: String(def?.maxTurns ?? 1),
          webSearchEnabled: def?.webSearchEnabled ?? false,
        });
        setAgentMemories(data.memories || []);
        setAgentToolIds((data.tools || []).map((t) => t.toolId));
        setAgentSkillIds((data.skills || []).map((s) => s.skillId));
      } else {
        setError("Agent not found");
      }
    } catch {
      setError("Failed to load agent");
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogData = async () => {
    try {
      const [memRes, toolsRes, skillsRes] = await Promise.all([
        fetch("/api/memory"),
        fetch("/api/tools"),
        fetch("/api/skills"),
      ]);

      if (memRes.ok) {
        const data = await memRes.json();
        setAllCollections(data.map((c: MemoryCollectionOption) => ({
          id: c.id, name: c.name, description: c.description, totalSize: c.totalSize,
        })));
      }
      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setAllTools(data.connectors || []);
      }
      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setAllSkills(data.skills || []);
      }
    } catch { /* ignore */ }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
        }),
      });

      await fetch(`/api/agents/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: JSON.stringify({
            model: form.model,
            systemPrompt: form.systemPrompt,
            tools: agent?.latestVersion?.definition?.tools || [],
            maxTurns: parseInt(form.maxTurns) || 1,
            temperature: parseFloat(form.temperature),
            webSearchEnabled: form.webSearchEnabled,
          }),
          changelog: "Updated configuration",
        }),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      const res = await fetch(`/api/agents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
        setAgentMemories(data.memories || []);
        setAgentToolIds((data.tools || []).map((t: { toolId: string }) => t.toolId));
        setAgentSkillIds((data.skills || []).map((s: { skillId: string }) => s.skillId));
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  // Memory attach/detach
  const handleAttachMemory = async () => {
    if (!selectedCollection) return;
    try {
      await fetch(`/api/memory/${selectedCollection}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, action: "attach" }),
      });
      setMemoryDialogOpen(false);
      setSelectedCollection("");
      fetchAgent();
    } catch { /* ignore */ }
  };

  const handleDetachMemory = async (collectionId: string) => {
    try {
      await fetch(`/api/memory/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, action: "detach" }),
      });
      fetchAgent();
    } catch { /* ignore */ }
  };

  // Tool attach/detach (per-agent)
  const handleAttachTool = async () => {
    if (!selectedTool) return;
    try {
      await fetch(`/api/agents/${id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: selectedTool }),
      });
      setToolDialogOpen(false);
      setSelectedTool("");
      fetchAgent();
    } catch { /* ignore */ }
  };

  const handleDetachTool = async (toolId: string) => {
    try {
      await fetch(`/api/agents/${id}/tools?toolId=${encodeURIComponent(toolId)}`, {
        method: "DELETE",
      });
      fetchAgent();
    } catch { /* ignore */ }
  };

  // Skill attach/detach (per-agent)
  const handleAttachSkill = async () => {
    if (!selectedSkill) return;
    try {
      await fetch(`/api/agents/${id}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: selectedSkill }),
      });
      setSkillDialogOpen(false);
      setSelectedSkill("");
      fetchAgent();
    } catch { /* ignore */ }
  };

  const handleDetachSkill = async (skillId: string) => {
    try {
      await fetch(`/api/agents/${id}/skills?skillId=${encodeURIComponent(skillId)}`, {
        method: "DELETE",
      });
      fetchAgent();
    } catch { /* ignore */ }
  };

  const availableCollections = allCollections.filter(
    (c) => !agentMemories?.some((m) => m.collectionId === c.id)
  );
  const availableTools = allTools.filter(
    (t) => !agentToolIds.includes(t.id)
  );
  const availableSkills = allSkills.filter(
    (s) => !agentSkillIds.includes(s.id)
  );

  // Map tool/skill IDs to their full data
  const assignedTools = allTools.filter((t) => agentToolIds.includes(t.id));
  const assignedSkills = allSkills.filter((s) => agentSkillIds.includes(s.id));

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4 max-w-3xl">
          <div className="h-[400px] rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16">
        <h2 className="text-xl font-semibold">Agent not found</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-3xl">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          Changes saved successfully.
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input id="name" name="name" value={form.name} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            value={form.systemPrompt}
            onChange={handleChange}
            rows={8}
            className="font-mono text-sm"
            placeholder="You are a helpful assistant..."
          />
        </CardContent>
      </Card>

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={form.model} onValueChange={(v) => setForm((p) => ({ ...p, model: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                  <SelectItem value="claude-sonnet-4-5-20241022">Claude Sonnet 4.5</SelectItem>
                  <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
                  <SelectItem value="claude-opus-4-5-20250520">Claude Opus 4.5</SelectItem>
                  <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input id="temperature" name="temperature" type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTurns">Max Turns</Label>
              <Input id="maxTurns" name="maxTurns" type="number" min="1" max="20" value={form.maxTurns} onChange={handleChange} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capabilities</CardTitle>
          <CardDescription>Enable built-in tools and integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-100 dark:bg-blue-900/50 p-2">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Web Search</p>
                <p className="text-xs text-muted-foreground">
                  Allow the agent to search the web for up-to-date information
                </p>
              </div>
            </div>
            <Switch
              checked={form.webSearchEnabled}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, webSearchEnabled: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Memory Collections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Memory
              </CardTitle>
              <CardDescription>
                Attach knowledge bases to give the agent access to your documents
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/memory">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Manage
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMemoryDialogOpen(true)}
                disabled={availableCollections.length === 0}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Attach
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!agentMemories || agentMemories.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No memory collections attached.
              <br />
              {allCollections.length === 0 ? (
                <span>
                  <Link href="/memory" className="text-primary hover:underline">Create a collection</Link> first, then attach it here.
                </span>
              ) : (
                <span>Attach a collection to give this agent access to documents.</span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {agentMemories.map((mem) => (
                <div key={mem.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-purple-100 dark:bg-purple-900/50 p-1.5">
                      <Brain className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{mem.collection.name}</p>
                      {mem.collection.description && (
                        <p className="text-xs text-muted-foreground truncate">{mem.collection.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-[10px]">linked</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDetachMemory(mem.collectionId)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Tools (per-agent) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Tools
              </CardTitle>
              <CardDescription>
                Assign MCP tool integrations to this agent
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/tools">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Browse
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setToolDialogOpen(true)}
                disabled={availableTools.length === 0}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Assign
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assignedTools.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No tools assigned to this agent.
              <br />
              <span>
                <Link href="/tools" className="text-primary hover:underline">Browse available tools</Link>, then assign them here.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedTools.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-blue-100 dark:bg-blue-900/50 p-1.5">
                      <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tool.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{tool.category}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDetachTool(tool.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Skills (per-agent) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Skills
              </CardTitle>
              <CardDescription>
                Assign skills to enhance this agent&apos;s capabilities
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/skills">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Browse
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSkillDialogOpen(true)}
                disabled={availableSkills.length === 0}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Assign
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assignedSkills.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No skills assigned to this agent.
              <br />
              <span>
                <Link href="/skills" className="text-primary hover:underline">Browse available skills</Link>, then assign them here.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedSkills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-purple-100 dark:bg-purple-900/50 p-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{skill.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{skill.category}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDetachSkill(skill.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Attach Memory Dialog */}
      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Memory Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Collection</Label>
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a collection..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCollections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAttachMemory} disabled={!selectedCollection}>
              <Link2 className="h-4 w-4 mr-2" /> Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tool Dialog */}
      <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tool to Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Tool</Label>
              <Select value={selectedTool} onValueChange={setSelectedTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tool..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTools.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        {t.name}
                        <span className="text-muted-foreground text-xs">({t.category})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTool && (
                <p className="text-xs text-muted-foreground">
                  {allTools.find((t) => t.id === selectedTool)?.description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToolDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAttachTool} disabled={!selectedTool}>
              <Link2 className="h-4 w-4 mr-2" /> Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Skill Dialog */}
      <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Skill to Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a skill..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.name}
                        <span className="text-muted-foreground text-xs">({s.category})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSkill && (
                <p className="text-xs text-muted-foreground">
                  {allSkills.find((s) => s.id === selectedSkill)?.description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAttachSkill} disabled={!selectedSkill}>
              <Link2 className="h-4 w-4 mr-2" /> Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
