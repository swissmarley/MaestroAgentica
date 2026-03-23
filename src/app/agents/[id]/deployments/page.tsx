"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Rocket,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  MessageSquare,
  Copy,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatInterface } from "@/components/playground/chat-interface";

interface Deployment {
  id: string;
  environment: string;
  status: string;
  versionId: string;
  version?: string;
  startedAt: string | null;
  stoppedAt: string | null;
}

interface VersionItem {
  id: string;
  version: string;
}

interface EnvVar {
  key: string;
  value: string;
}

const envConfigs = [
  { name: "Development", key: "dev", description: "For internal testing and iteration" },
  { name: "Staging", key: "staging", description: "Pre-production validation" },
  { name: "Production", key: "prod", description: "Live, user-facing deployment" },
];

const statusIcons: Record<string, typeof CheckCircle2> = {
  running: CheckCircle2,
  stopped: Square,
  failed: XCircle,
  deploying: RefreshCw,
  pending: Clock,
};

const statusColors: Record<string, string> = {
  running: "text-green-500",
  stopped: "text-gray-400",
  failed: "text-red-500",
  deploying: "text-blue-500 animate-spin",
  pending: "text-amber-500",
};

export default function DeploymentsPage() {
  const params = useParams();
  const id = params.id as string;
  const [deployments, setDeployments] = useState<Record<string, Deployment | null>>({
    dev: null, staging: null, prod: null,
  });
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployEnv, setDeployEnv] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", value: "" }]);
  const [chatEnv, setChatEnv] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadData() {
    try {
      const [deployRes, agentRes] = await Promise.all([
        fetch(`/api/agents/${id}/deploy`),
        fetch(`/api/agents/${id}`),
      ]);

      if (deployRes.ok) {
        const deps = await deployRes.json();
        const mapped: Record<string, Deployment | null> = { dev: null, staging: null, prod: null };
        for (const d of deps) {
          mapped[d.environment] = d;
        }
        setDeployments(mapped);
      }

      if (agentRes.ok) {
        const agent = await agentRes.json();
        if (agent.versions) {
          setVersions(agent.versions.map((v: { id: string; version: string }) => ({
            id: v.id,
            version: v.version,
          })));
          if (agent.versions.length > 0 && !selectedVersion) {
            setSelectedVersion(agent.versions[0].id);
          }
        }
      }
    } catch {
      // Network error
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const config: Record<string, string> = {};
      for (const v of envVars) {
        if (v.key.trim()) config[v.key.trim()] = v.value;
      }

      const res = await fetch(`/api/agents/${id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: deployEnv,
          versionId: selectedVersion || undefined,
          config,
        }),
      });

      if (res.ok) {
        setDeployOpen(false);
        loadData();
      }
    } catch {
      // handle error
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async (environment: string) => {
    try {
      await fetch(`/api/agents/${id}/deploy?environment=${environment}`, {
        method: "DELETE",
      });
      loadData();
    } catch {
      // handle error
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (index: number) =>
    setEnvVars(envVars.filter((_, i) => i !== index));

  const runningEnvs = envConfigs.filter((e) => deployments[e.key]?.status === "running");

  const apiEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/agents/${id}/test`
    : `/api/agents/${id}/test`;

  const copyEndpoint = () => {
    navigator.clipboard.writeText(apiEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Environment Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {envConfigs.map((env) => {
          const dep = deployments[env.key];
          const status = dep?.status || "stopped";
          const StatusIcon = statusIcons[status] || AlertCircle;

          return (
            <Card key={env.key} className={dep ? "" : "border-dashed"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      status === "running" ? "bg-green-500" :
                      status === "failed" ? "bg-red-500" :
                      "bg-gray-300"
                    }`} />
                    {env.name}
                  </CardTitle>
                  <Badge variant={status === "running" ? "success" : "secondary"}>
                    {status}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{env.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dep ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <StatusIcon className={`h-4 w-4 ${statusColors[status]}`} />
                      <span className="text-muted-foreground">
                        {dep.version || "unknown"}
                      </span>
                    </div>
                    {dep.startedAt && (
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(dep.startedAt).toLocaleString()}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {status === "running" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setChatEnv(env.key)}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> Chat
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleStop(env.key)}
                          >
                            <Square className="h-3 w-3 mr-1" /> Stop
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setDeployEnv(env.key);
                            setDeployOpen(true);
                          }}
                        >
                          <Rocket className="h-3 w-3 mr-1" /> Redeploy
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Not deployed
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDeployEnv(env.key);
                        setDeployOpen(true);
                      }}
                    >
                      <Rocket className="h-3 w-3 mr-1" /> Deploy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Access Deployed Agents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Access Deployed Agents
          </CardTitle>
          <CardDescription>
            Interact with your running deployments via chat or API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {runningEnvs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No running deployments. Deploy to an environment above to get started.
            </p>
          ) : (
            <Tabs defaultValue={runningEnvs[0]?.key}>
              <TabsList>
                {runningEnvs.map((env) => (
                  <TabsTrigger key={env.key} value={env.key}>
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                    {env.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {runningEnvs.map((env) => (
                <TabsContent key={env.key} value={env.key} className="space-y-4">
                  {/* API Endpoint */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      API Endpoint
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={apiEndpoint}
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={copyEndpoint}>
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? " Copied" : ""}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      POST with <code className="font-mono bg-muted px-1 rounded">{"{ \"prompt\": \"your message\" }"}</code> to interact via API.
                    </p>
                  </div>

                  {/* Inline Chat */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Chat with {env.name} deployment
                    </Label>
                    <div className="border rounded-lg h-[400px] overflow-hidden">
                      <ChatInterface
                        agentId={id}
                        versionId={deployments[env.key]?.versionId}
                      />
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Variables</CardTitle>
          <CardDescription>
            Variables are passed to the agent&apos;s runtime configuration on deploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {envVars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                className="font-mono text-sm flex-1"
                value={v.key}
                onChange={(e) => {
                  const updated = [...envVars];
                  updated[i].key = e.target.value;
                  setEnvVars(updated);
                }}
              />
              <Input
                placeholder="value"
                className="font-mono text-sm flex-1"
                type="password"
                value={v.value}
                onChange={(e) => {
                  const updated = [...envVars];
                  updated[i].value = e.target.value;
                  setEnvVars(updated);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeEnvVar(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addEnvVar}>
            <Plus className="h-3 w-3 mr-1" /> Add Variable
          </Button>
        </CardContent>
      </Card>

      {/* Deploy Dialog */}
      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Deploy to {envConfigs.find((e) => e.key === deployEnv)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Version</Label>
              <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeploy} disabled={deploying || !selectedVersion}>
              <Rocket className="h-4 w-4 mr-2" />
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog for quick access */}
      <Dialog open={!!chatEnv} onOpenChange={() => setChatEnv(null)}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat &mdash; {envConfigs.find((e) => e.key === chatEnv)?.name}
              <Badge variant="success" className="ml-2">running</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {chatEnv && (
              <ChatInterface
                agentId={id}
                versionId={deployments[chatEnv]?.versionId}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
