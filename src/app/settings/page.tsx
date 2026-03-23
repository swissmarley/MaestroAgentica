"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Settings2,
  Palette,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Download,
  Info,
  Save,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  DialogDescription,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [savedKeyDisplay, setSavedKeyDisplay] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-6");
  const [theme, setTheme] = useState("system");
  const [clearOpen, setClearOpen] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.anthropic_api_key) {
            setSavedKeyDisplay(data.anthropic_api_key);
          }
          if (data.default_model) {
            setDefaultModel(data.default_model);
          }
          if (data.theme) {
            setTheme(data.theme);
          }
        }
      } catch {
        // Settings not loaded
      }
    }
    loadSettings();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    setKeySaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "anthropic_api_key", value: apiKey }),
      });
      if (res.ok) {
        setKeySaved(true);
        setSavedKeyDisplay(apiKey.slice(0, 7) + "..." + apiKey.slice(-4));
        setApiKey("");
        setTimeout(() => setKeySaved(false), 3000);
      }
    } catch {
      // save failed
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestMessage("");
    try {
      const keyToTest = apiKey.trim() || undefined;

      // If there's a new key entered, save it first
      if (keyToTest) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "anthropic_api_key", value: keyToTest }),
        });
        setSavedKeyDisplay(keyToTest.slice(0, 7) + "..." + keyToTest.slice(-4));
        setApiKey("");
      }

      // Test by making a small API call
      const res = await fetch("/api/settings/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult("success");
        setTestMessage("Connected successfully.");
      } else {
        setTestResult("error");
        setTestMessage(data.error || "Connection failed.");
      }
    } catch {
      setTestResult("error");
      setTestMessage("Network error.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveModel = async (value: string) => {
    setDefaultModel(value);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "default_model", value }),
    });
  };

  const handleThemeChange = async (value: string) => {
    setTheme(value);
    if (value === "dark") {
      document.documentElement.classList.add("dark");
    } else if (value === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "theme", value }),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-3xl">
      <Header
        title="Settings"
        description="Configure your Maestro Agentica workspace"
      />

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Connect your Anthropic API key to enable agent execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedKeyDisplay && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-mono">{savedKeyDisplay}</span>
              </div>
              <Badge variant="success">Saved</Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {savedKeyDisplay ? "Update API Key" : "Anthropic API Key"}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-10 font-mono text-sm"
                />
                <button
                  className="absolute right-2 top-2.5"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <Button
                onClick={handleSaveKey}
                disabled={savingKey || !apiKey.trim()}
              >
                {savingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-2">Save</span>
              </Button>
            </div>
            {keySaved && (
              <p className="text-sm text-green-600">API key saved successfully.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || (!apiKey && !savedKeyDisplay)}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : testResult === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
              ) : testResult === "error" ? (
                <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              ) : null}
              Test Connection
            </Button>
          </div>
          {testResult === "success" && (
            <p className="text-sm text-green-600">{testMessage}</p>
          )}
          {testResult === "error" && (
            <p className="text-sm text-red-600">{testMessage}</p>
          )}

          <div className="rounded-md bg-muted/50 p-3 flex gap-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your API key is stored in the local database and never sent externally.
              You can also set it via the <code className="font-mono">ANTHROPIC_API_KEY</code> environment variable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Default Agent Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Default Agent Settings
          </CardTitle>
          <CardDescription>
            Defaults for newly created agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Model</Label>
            <Select value={defaultModel} onValueChange={handleSaveModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                <SelectItem value="claude-sonnet-4-5-20241022">Claude Sonnet 4.5</SelectItem>
                <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
                <SelectItem value="claude-opus-4-5-20250520">Claude Opus 4.5</SelectItem>
                <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export All Data</p>
              <p className="text-xs text-muted-foreground">
                Download all agents, versions, and settings as JSON.
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">
                Clear All Data
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently delete all agents, versions, logs, and metrics.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Maestro Agentica</p>
              <p className="text-xs text-muted-foreground">
                v0.1.0 &middot; Built on Claude Agents SDK
              </p>
            </div>
            <Badge variant="outline">Beta</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Clear Confirmation */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete all agents, versions, logs, metrics,
              and sessions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
