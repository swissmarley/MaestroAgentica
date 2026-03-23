"use client";

import { useEffect, useState, useRef } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Upload,
  FileText,
  HardDrive,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
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

interface MemoryDocument {
  id: string;
  fileName: string;
  fileSize: number;
  chunkCount: number;
  status: string;
  createdAt: string;
}

interface AgentLink {
  id: string;
  agentId: string;
  agent: { id: string; name: string };
}

interface MemoryCollection {
  id: string;
  name: string;
  description: string;
  chromaId: string;
  totalSize: number;
  documents: MemoryDocument[];
  agents: AgentLink[];
  createdAt: string;
}

interface AgentOption {
  id: string;
  name: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function MemoryPage() {
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newCollection, setNewCollection] = useState({ name: "", description: "" });
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textUpload, setTextUpload] = useState({ fileName: "", content: "" });
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");

  useEffect(() => {
    fetchCollections();
    fetchAgents();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) setCollections(await res.json());
    } catch {
      // failed
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.map((a: AgentOption) => ({ id: a.id, name: a.name })));
      }
    } catch {
      // failed
    }
  };

  const handleCreate = async () => {
    if (!newCollection.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCollection),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewCollection({ name: "", description: "" });
        fetchCollections();
      }
    } catch {
      // failed
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      fetchCollections();
    } catch {
      // failed
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;
    setUploading(true);

    try {
      const formData = new FormData();

      if (uploadMode === "file" && fileInputRef.current?.files?.[0]) {
        formData.append("file", fileInputRef.current.files[0]);
      } else if (uploadMode === "text" && textUpload.content.trim()) {
        formData.append("content", textUpload.content);
        formData.append("fileName", textUpload.fileName || "document.txt");
      } else {
        setUploading(false);
        return;
      }

      const res = await fetch(`/api/memory/${selectedCollection}/documents`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadOpen(false);
        setTextUpload({ fileName: "", content: "" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchCollections();
      }
    } catch {
      // failed
    } finally {
      setUploading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedCollection || !selectedAgent) return;
    try {
      await fetch(`/api/memory/${selectedCollection}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, action: "attach" }),
      });
      setLinkOpen(false);
      setSelectedAgent("");
      fetchCollections();
    } catch {
      // failed
    }
  };

  const handleUnlink = async (collectionId: string, agentId: string) => {
    try {
      await fetch(`/api/memory/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: "detach" }),
      });
      fetchCollections();
    } catch {
      // failed
    }
  };

  const filtered = collections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-[200px] rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Header title="Memory" description="Manage knowledge bases powered by ChromaDB">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Collection
        </Button>
      </Header>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search collections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Collections Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No memory collections</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a collection and upload documents to build a knowledge base.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((collection) => (
            <Card key={collection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 dark:bg-purple-900/50 p-2.5">
                      <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{collection.name}</CardTitle>
                      {collection.description && (
                        <CardDescription className="mt-0.5">
                          {collection.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCollection(collection.id);
                        setUploadOpen(true);
                      }}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCollection(collection.id);
                        setLinkOpen(true);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Link Agent
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(collection.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>{formatBytes(collection.totalSize)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{collection.documents.length} document{collection.documents.length !== 1 ? "s" : ""}</span>
                  </div>
                  {collection.agents.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>{collection.agents.length} agent{collection.agents.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>

                {/* Linked Agents */}
                {collection.agents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {collection.agents.map((link) => (
                      <Badge key={link.id} variant="secondary" className="gap-1 pr-1">
                        {link.agent.name}
                        <button
                          onClick={() => handleUnlink(collection.id, link.agentId)}
                          className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Documents expandable */}
                {collection.documents.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedId === collection.id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {expandedId === collection.id ? "Hide" : "Show"} documents
                    </button>
                    {expandedId === collection.id && (
                      <div className="mt-2 space-y-1.5">
                        {collection.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{doc.fileName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatBytes(doc.fileSize)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {doc.chunkCount} chunks
                              </span>
                            </div>
                            <Badge
                              variant={doc.status === "ready" ? "success" : doc.status === "processing" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {doc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Memory Collection</DialogTitle>
            <DialogDescription>
              Create a knowledge base to store and retrieve documents using vector embeddings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., Product Documentation"
                value={newCollection.name}
                onChange={(e) => setNewCollection((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What kind of knowledge does this collection contain?"
                value={newCollection.description}
                onChange={(e) => setNewCollection((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newCollection.name.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document to this memory collection. Content will be chunked and embedded.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={uploadMode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadMode("file")}
              >
                File Upload
              </Button>
              <Button
                type="button"
                variant={uploadMode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadMode("text")}
              >
                Paste Text
              </Button>
            </div>

            {uploadMode === "file" ? (
              <div className="space-y-2">
                <Label>Select File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.csv,.html,.xml,.yaml,.yml,.pdf,.docx,.xlsx,.xls,.rtf"
                />
                <p className="text-xs text-muted-foreground">
                  Supports PDF, DOCX, XLSX, TXT, MD, RTF, JSON, CSV, HTML, XML, YAML
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>File Name</Label>
                  <Input
                    placeholder="document.txt"
                    value={textUpload.fileName}
                    onChange={(e) => setTextUpload((p) => ({ ...p, fileName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    placeholder="Paste document content here..."
                    rows={8}
                    className="font-mono text-sm"
                    value={textUpload.content}
                    onChange={(e) => setTextUpload((p) => ({ ...p, content: e.target.value }))}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Agent Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Agent to Memory</DialogTitle>
            <DialogDescription>
              Attach this memory collection to an agent so it can access the knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={handleLink} disabled={!selectedAgent}>
              Link Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
