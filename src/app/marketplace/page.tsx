"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  Package,
  FileArchive,
  Search,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  versions: Array<{ id: string; version: string }>;
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [exportForm, setExportForm] = useState({
    author: "",
    license: "MIT",
    tags: "",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        // fallback
      }
    }
    load();
  }, []);

  const handleExport = async () => {
    if (!selectedAgent) return;
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedAgent.name.toLowerCase().replace(/\s+/g, "-")}-agent.tar.gz`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // handle error
    }
    setExportOpen(false);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setImportOpen(false);
        setImportFile(null);
        // Reload agents
        const agentsRes = await fetch("/api/agents");
        if (agentsRes.ok) setAgents(await agentsRes.json());
      }
    } catch {
      // handle error
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Header
        title="Marketplace"
        description="Export and import agent packages"
      >
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import Agent
        </Button>
      </Header>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </TabsTrigger>
          <TabsTrigger value="browse">
            <Package className="h-4 w-4 mr-2" />
            Browse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No agents to export</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create an agent first, then you can export it as a package.
                  </p>
                </CardContent>
              </Card>
            ) : (
              agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <Badge variant="secondary">{agent.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {agent.description || "No description"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {agent.versions?.length || 0} version(s)
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAgent(agent);
                          setExportOpen(true);
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" /> Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="browse" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Coming Soon</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
                The marketplace will allow you to browse and install agents shared by the community. Import agents manually for now.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Configure the export package metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Author</Label>
              <Input
                value={exportForm.author}
                onChange={(e) =>
                  setExportForm({ ...exportForm, author: e.target.value })
                }
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>License</Label>
              <Select
                value={exportForm.license}
                onValueChange={(v) =>
                  setExportForm({ ...exportForm, license: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIT">MIT</SelectItem>
                  <SelectItem value="Apache-2.0">Apache 2.0</SelectItem>
                  <SelectItem value="proprietary">Proprietary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={exportForm.tags}
                onChange={(e) =>
                  setExportForm({ ...exportForm, tags: e.target.value })
                }
                placeholder="customer-support, ai, chatbot"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Agent Package</DialogTitle>
            <DialogDescription>
              Upload a .tar.gz agent package to import.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() =>
                document.getElementById("import-file-input")?.click()
              }
            >
              <FileArchive className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              {importFile ? (
                <div>
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    Drop a file or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .tar.gz and .json files
                  </p>
                </div>
              )}
              <input
                id="import-file-input"
                type="file"
                accept=".tar.gz,.tgz,.json"
                className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
