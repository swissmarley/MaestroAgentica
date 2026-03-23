"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wrench,
  Plus,
  Search,
  Github,
  MessageSquare,
  FolderOpen,
  Database,
  Cloud,
  Brain,
  Monitor,
  ExternalLink,
  Check,
  Loader2,
  Plug,
  ChevronDown,
  ChevronUp,
  Code2,
  Info,
  Key,
  Link2,
  Unlink,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface McpConnector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authType: "oauth" | "api_key" | "connection_string" | "none";
  authUrl?: string;
  mcpEndpoint: string;
  status: string;
  tools: string[];
}

interface ToolConnection {
  connected: boolean;
  authType: string;
  apiKey?: string;
  connectionString?: string;
  oauthToken?: string;
  connectedAt?: string;
}

type ConnectionMap = Record<string, ToolConnection>;

const ICON_MAP: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  slack: <MessageSquare className="h-5 w-5" />,
  folder: <FolderOpen className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  cloud: <Cloud className="h-5 w-5" />,
  brain: <Brain className="h-5 w-5" />,
  globe: <Monitor className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Development: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  Communication: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  System: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  Data: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  Search: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  Productivity: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
  AI: "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
  Automation: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300",
  Custom: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
};

const AUTH_LABELS: Record<string, string> = {
  none: "No Auth Required",
  oauth: "OAuth 2.0",
  api_key: "API Key",
  connection_string: "Connection String",
};

export default function ToolsPage() {
  const [connectors, setConnectors] = useState<McpConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionMap>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTool, setNewTool] = useState({ name: "", description: "", mcpEndpoint: "", inputSchema: "" });

  // Connection dialog state
  const [connectDialog, setConnectDialog] = useState<McpConnector | null>(null);
  const [connectForm, setConnectForm] = useState({ apiKey: "", connectionString: "" });
  const [connecting, setConnecting] = useState(false);
  const [oauthPending, setOauthPending] = useState<string | null>(null);

  useEffect(() => {
    fetchTools();
    loadConnections();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await fetch("/api/tools");
      if (res.ok) {
        const data = await res.json();
        setConnectors(data.connectors || []);
      }
    } catch { /* failed */ } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.tool_connections) {
          try {
            setConnections(JSON.parse(data.tool_connections));
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  };

  const saveConnections = useCallback(async (newConnections: ConnectionMap) => {
    setConnections(newConnections);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "tool_connections",
          value: JSON.stringify(newConnections),
        }),
      });
    } catch { /* ignore */ }
  }, []);

  // Handle OAuth flow
  const handleOAuthConnect = async (connector: McpConnector) => {
    setOauthPending(connector.id);

    // Open OAuth popup
    if (connector.authUrl) {
      const redirectUri = `${window.location.origin}/api/tools/callback`;
      const oauthUrl = `${connector.authUrl}?client_id=maestro_agentica&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read,write&state=${connector.id}`;
      const popup = window.open(oauthUrl, `oauth_${connector.id}`, "width=600,height=700,scrollbars=yes");

      // Poll for popup close (simulated OAuth completion)
      const checkClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkClosed);
          completeOAuth(connector.id);
        }
      }, 500);

      // Auto-complete after 5s if popup is still open (simulated)
      setTimeout(() => {
        clearInterval(checkClosed);
        if (popup && !popup.closed) popup.close();
        completeOAuth(connector.id);
      }, 5000);
    } else {
      // No auth URL, simulate quick connection
      await new Promise((r) => setTimeout(r, 1500));
      completeOAuth(connector.id);
    }
  };

  const completeOAuth = (connectorId: string) => {
    const newConnections = {
      ...connections,
      [connectorId]: {
        connected: true,
        authType: "oauth",
        oauthToken: "oauth_token_" + Date.now(),
        connectedAt: new Date().toISOString(),
      },
    };
    saveConnections(newConnections);
    setOauthPending(null);
  };

  // Handle API Key connection
  const handleApiKeyConnect = async (connector: McpConnector) => {
    if (!connectForm.apiKey.trim()) return;
    setConnecting(true);

    // Simulate validation delay
    await new Promise((r) => setTimeout(r, 1000));

    const newConnections = {
      ...connections,
      [connector.id]: {
        connected: true,
        authType: "api_key",
        apiKey: connectForm.apiKey.trim(),
        connectedAt: new Date().toISOString(),
      },
    };
    await saveConnections(newConnections);
    setConnecting(false);
    setConnectDialog(null);
    setConnectForm({ apiKey: "", connectionString: "" });
  };

  // Handle Connection String
  const handleConnectionStringConnect = async (connector: McpConnector) => {
    if (!connectForm.connectionString.trim()) return;
    setConnecting(true);

    await new Promise((r) => setTimeout(r, 1000));

    const newConnections = {
      ...connections,
      [connector.id]: {
        connected: true,
        authType: "connection_string",
        connectionString: connectForm.connectionString.trim(),
        connectedAt: new Date().toISOString(),
      },
    };
    await saveConnections(newConnections);
    setConnecting(false);
    setConnectDialog(null);
    setConnectForm({ apiKey: "", connectionString: "" });
  };

  // Handle no-auth connection
  const handleNoAuthConnect = async (connector: McpConnector) => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 800));

    const newConnections = {
      ...connections,
      [connector.id]: {
        connected: true,
        authType: "none",
        connectedAt: new Date().toISOString(),
      },
    };
    await saveConnections(newConnections);
    setConnecting(false);
  };

  // Disconnect tool
  const handleDisconnect = async (connectorId: string) => {
    const newConnections = { ...connections };
    delete newConnections[connectorId];
    await saveConnections(newConnections);
  };

  // Initiate connection based on auth type
  const initiateConnect = (connector: McpConnector) => {
    switch (connector.authType) {
      case "oauth":
        handleOAuthConnect(connector);
        break;
      case "api_key":
      case "connection_string":
        setConnectDialog(connector);
        setConnectForm({ apiKey: "", connectionString: "" });
        break;
      case "none":
        handleNoAuthConnect(connector);
        break;
    }
  };

  const handleCreateTool = async () => {
    if (!newTool.name.trim()) return;
    try {
      let schema = {};
      if (newTool.inputSchema.trim()) {
        try { schema = JSON.parse(newTool.inputSchema); } catch { return; }
      }
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTool.name, description: newTool.description, inputSchema: schema, mcpEndpoint: newTool.mcpEndpoint }),
      });
      if (res.ok) {
        const created = await res.json();
        setConnectors((prev) => [...prev, { ...created, icon: "wrench", tools: [], authType: "none" as const, status: "configured" }]);
      }
      setCreateOpen(false);
      setNewTool({ name: "", description: "", mcpEndpoint: "", inputSchema: "" });
    } catch { /* failed */ }
  };

  const categories = ["all", ...Array.from(new Set(connectors.map((c) => c.category)))];

  const filtered = connectors.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const connectedCount = Object.values(connections).filter((c) => c.connected).length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[200px] rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Header title="Tools" description="Manage MCP integrations, connections, and custom tools">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Custom Tool
        </Button>
      </Header>

      {/* Info banner */}
      <div className="rounded-md bg-muted/50 border px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Connect</strong> tools here to configure credentials and enable integrations. Then <strong>assign</strong> specific tools to individual agents from each agent&apos;s configuration page.</p>
          <p>{connectedCount} of {connectors.length} tools connected</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat === "all" ? "All Categories" : cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Connectors Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((connector) => {
          const isExpanded = expandedId === connector.id;
          const conn = connections[connector.id];
          const isConnected = conn?.connected === true;
          const isOAuthPending = oauthPending === connector.id;

          return (
            <Card key={connector.id} className={`flex flex-col ${isConnected ? "border-green-300 dark:border-green-800" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2.5 ${CATEGORY_COLORS[connector.category] || CATEGORY_COLORS.Custom}`}>
                      {ICON_MAP[connector.icon] || <Wrench className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{connector.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] mt-1">{connector.category}</Badge>
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="success" className="text-[10px]">
                      <Check className="h-3 w-3 mr-0.5" /> Connected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-2">{connector.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-end gap-3">
                {/* Tools preview */}
                <div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : connector.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Code2 className="h-3 w-3" />
                    {connector.tools.length} tools
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {connector.tools.map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-[10px] font-mono">{tool}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* MCP endpoint */}
                <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate">
                  {connector.mcpEndpoint}
                </div>

                {/* Auth type & connection info */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {connector.authType === "none" ? <Shield className="h-2.5 w-2.5 mr-0.5" /> : <Key className="h-2.5 w-2.5 mr-0.5" />}
                    {AUTH_LABELS[connector.authType]}
                  </Badge>
                  {isConnected && conn.connectedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      since {new Date(conn.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Connect/Disconnect */}
                {isConnected ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDisconnect(connector.id)}>
                      <Unlink className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                    </Button>
                    {(connector.authType === "api_key" || connector.authType === "connection_string") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConnectDialog(connector);
                          setConnectForm({
                            apiKey: conn.apiKey ? conn.apiKey.slice(0, 8) + "..." : "",
                            connectionString: conn.connectionString ? conn.connectionString.slice(0, 20) + "..." : "",
                          });
                        }}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => initiateConnect(connector)}
                    disabled={isOAuthPending || (connecting && connectDialog?.id === connector.id)}
                  >
                    {isOAuthPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Authorizing...</>
                    ) : (
                      <><Plug className="h-3.5 w-3.5 mr-1.5" /> Connect</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No tools found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or category filter.</p>
          </CardContent>
        </Card>
      )}

      {/* API Key / Connection String Dialog */}
      <Dialog open={!!connectDialog} onOpenChange={(open) => { if (!open) { setConnectDialog(null); setConnectForm({ apiKey: "", connectionString: "" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectDialog && ICON_MAP[connectDialog.icon]}
              Connect {connectDialog?.name}
            </DialogTitle>
            <DialogDescription>
              {connectDialog?.authType === "api_key"
                ? `Enter your API key to connect to ${connectDialog?.name}. Your key is stored securely.`
                : `Enter the connection string for your ${connectDialog?.name} instance.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {connectDialog?.authType === "api_key" && (
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Enter your API key..."
                    className="pl-9 font-mono text-sm"
                    value={connectForm.apiKey}
                    onChange={(e) => setConnectForm((p) => ({ ...p, apiKey: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can find your API key in the {connectDialog.name} dashboard settings.
                </p>
              </div>
            )}

            {connectDialog?.authType === "connection_string" && (
              <div className="space-y-2">
                <Label>Connection String</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="postgresql://user:password@host:5432/dbname"
                    className="pl-9 font-mono text-sm"
                    value={connectForm.connectionString}
                    onChange={(e) => setConnectForm((p) => ({ ...p, connectionString: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Provide the full connection URI including credentials.
                </p>
              </div>
            )}

            {/* MCP endpoint preview */}
            <div className="rounded-md bg-muted/50 border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">MCP Endpoint</p>
              <p className="text-xs font-mono">{connectDialog?.mcpEndpoint}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConnectDialog(null); setConnectForm({ apiKey: "", connectionString: "" }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!connectDialog) return;
                if (connectDialog.authType === "api_key") handleApiKeyConnect(connectDialog);
                else if (connectDialog.authType === "connection_string") handleConnectionStringConnect(connectDialog);
              }}
              disabled={
                connecting ||
                (connectDialog?.authType === "api_key" && !connectForm.apiKey.trim()) ||
                (connectDialog?.authType === "connection_string" && !connectForm.connectionString.trim())
              }
            >
              {connecting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Connecting...</>
              ) : (
                <><Plug className="h-4 w-4 mr-2" /> Connect</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Tool Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Tool</DialogTitle>
            <DialogDescription>Define a custom tool or connect to an MCP server endpoint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tool Name</Label>
              <Input placeholder="e.g., my-api-tool" value={newTool.name} onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this tool do?" value={newTool.description} onChange={(e) => setNewTool((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>MCP Server Endpoint</Label>
              <Input placeholder="npx -y @my-org/mcp-server or http://localhost:3001/mcp" className="font-mono text-sm" value={newTool.mcpEndpoint} onChange={(e) => setNewTool((p) => ({ ...p, mcpEndpoint: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Input Schema (JSON, optional)</Label>
              <Textarea placeholder='{"type": "object", "properties": {"query": {"type": "string"}}}' className="font-mono text-sm" rows={4} value={newTool.inputSchema} onChange={(e) => setNewTool((p) => ({ ...p, inputSchema: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTool} disabled={!newTool.name.trim()}>Create Tool</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
