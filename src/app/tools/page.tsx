"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wrench,
  Plus,
  Search,
  FolderOpen,
  Database,
  Cloud,
  Brain,
  Monitor,
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
import { CONNECTOR_ICON_MAP } from "@/components/icons/connector-icons";

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

// Fallback Lucide icons for connectors that don't have brand SVGs
const LUCIDE_ICON_MAP: Record<string, React.ReactNode> = {
  folder: <FolderOpen className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  cloud: <Cloud className="h-5 w-5" />,
  brain: <Brain className="h-5 w-5" />,
  globe: <Monitor className="h-5 w-5" />,
};

function ConnectorIcon({ iconKey, className = "h-5 w-5" }: { iconKey: string; className?: string }) {
  const BrandIcon = CONNECTOR_ICON_MAP[iconKey];
  if (BrandIcon) {
    return <BrandIcon className={className} />;
  }
  const lucideIcon = LUCIDE_ICON_MAP[iconKey];
  if (lucideIcon) {
    return <>{lucideIcon}</>;
  }
  return <Wrench className={className} />;
}

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
  CRM: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
  Design: "bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300",
  Finance: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
  "Project Management": "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
  Infrastructure: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isEditingConnection, setIsEditingConnection] = useState(false);

  useEffect(() => {
    fetchTools();
    loadConnections();
  }, []);

  // Listen for OAuth postMessage from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth_complete") {
        const { connectorId, success, tokenData } = event.data;
        if (success) {
          completeOAuth(connectorId, tokenData);
        } else {
          // User denied — just clear pending state
          setOauthPending(null);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  });

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

  // Handle OAuth flow — opens our own authorize page in a popup
  const handleOAuthConnect = (connector: McpConnector) => {
    setOauthPending(connector.id);

    const authorizeUrl = `/tools/oauth?connector=${encodeURIComponent(connector.id)}&name=${encodeURIComponent(connector.name)}`;
    const popup = window.open(authorizeUrl, `oauth_${connector.id}`, "width=500,height=680,scrollbars=yes");

    // If user closes popup without authorizing, clear pending state
    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        // Small delay to allow postMessage to arrive first
        setTimeout(() => {
          setOauthPending((current) => (current === connector.id ? null : current));
        }, 500);
      }
    }, 500);
  };

  const completeOAuth = (connectorId: string, tokenData?: { accessToken?: string; refreshToken?: string; expiresIn?: number; scope?: string; tokenType?: string }) => {
    const newConnections = {
      ...connections,
      [connectorId]: {
        connected: true,
        authType: "oauth",
        hasToken: !!tokenData?.accessToken,
        tokenType: tokenData?.tokenType || "Bearer",
        scope: tokenData?.scope || "",
        connectedAt: new Date().toISOString(),
      },
    };
    saveConnections(newConnections);
    setOauthPending(null);
    // Reload connections from server to sync with token storage
    loadConnections();
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

  // Handle test connection for API key tools
  const handleTestConnection = async () => {
    if (!connectDialog || !connectForm.apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/tools/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: connectDialog.id,
          apiKey: connectForm.apiKey.trim(),
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success === true,
        message: data.message || (data.success ? "Connection successful!" : "Connection failed."),
      });
    } catch {
      setTestResult({ success: false, message: "Failed to test connection. Check your network." });
    } finally {
      setTesting(false);
    }
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
    setIsEditingConnection(false);
    setTestResult(null);
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
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
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
                      <ConnectorIcon iconKey={connector.icon} />
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
                          setIsEditingConnection(true);
                          setConnectDialog(connector);
                          setConnectForm({ apiKey: "", connectionString: "" });
                          setTestResult(null);
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
      <Dialog open={!!connectDialog} onOpenChange={(open) => { if (!open) { setConnectDialog(null); setConnectForm({ apiKey: "", connectionString: "" }); setTestResult(null); setIsEditingConnection(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`rounded-md p-1.5 ${CATEGORY_COLORS[connectDialog?.category || "Custom"] || CATEGORY_COLORS.Custom}`}>
                {connectDialog && <ConnectorIcon iconKey={connectDialog.icon} className="h-4 w-4" />}
              </div>
              {isEditingConnection ? `Update ${connectDialog?.name}` : `Connect ${connectDialog?.name}`}
            </DialogTitle>
            <DialogDescription>
              {isEditingConnection
                ? `Update your credentials for ${connectDialog?.name}. Enter a new key to replace the existing one.`
                : connectDialog?.authType === "api_key"
                  ? `Enter your API key to connect to ${connectDialog?.name}. Your key is stored securely.`
                  : `Enter the connection string for your ${connectDialog?.name} instance.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Show current connection status when editing */}
            {isEditingConnection && connectDialog && connections[connectDialog.id]?.connected && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Currently connected
                  {connections[connectDialog.id]?.connectedAt && (
                    <> since {new Date(connections[connectDialog.id].connectedAt!).toLocaleDateString()}</>
                  )}
                  {connections[connectDialog.id]?.apiKey && (
                    <> — Key: {connections[connectDialog.id].apiKey!.slice(0, 8)}...{connections[connectDialog.id].apiKey!.slice(-4)}</>
                  )}
                </span>
              </div>
            )}

            {connectDialog?.authType === "api_key" && (
              <div className="space-y-2">
                <Label>{isEditingConnection ? "New API Key" : "API Key"}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={isEditingConnection ? "Enter new API key to replace..." : "Enter your API key..."}
                    className="pl-9 font-mono text-sm"
                    value={connectForm.apiKey}
                    onChange={(e) => setConnectForm((p) => ({ ...p, apiKey: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground flex-1">
                    You can find your API key in the {connectDialog.name} dashboard settings.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing || !connectForm.apiKey.trim()}
                    className="shrink-0"
                  >
                    {testing ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Testing...</>
                    ) : (
                      <><Plug className="h-3.5 w-3.5 mr-1" /> Test</>
                    )}
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                    testResult.success
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                  }`}>
                    {testResult.success ? (
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {connectDialog?.authType === "connection_string" && (
              <div className="space-y-2">
                <Label>{isEditingConnection ? "New Connection String" : "Connection String"}</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={
                      connectDialog.id === "mongodb"
                        ? "mongodb+srv://user:password@cluster.mongodb.net/dbname"
                        : connectDialog.id === "mysql"
                        ? "mysql://user:password@host:3306/dbname"
                        : "protocol://user:password@host:port/dbname"
                    }
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
            <Button variant="outline" onClick={() => { setConnectDialog(null); setConnectForm({ apiKey: "", connectionString: "" }); setIsEditingConnection(false); }}>
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
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isEditingConnection ? "Updating..." : "Connecting..."}</>
              ) : (
                <><Plug className="h-4 w-4 mr-2" /> {isEditingConnection ? "Update" : "Connect"}</>
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
