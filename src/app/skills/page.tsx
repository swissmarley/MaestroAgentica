"use client";

import { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Check,
  Code2,
  Shield,
  TestTube,
  FileText,
  Database,
  Brain,
  Paintbrush,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Info,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
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

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  version?: string;
  triggers?: string[];
  isCustom?: boolean;
  isImported?: boolean;
  packageName?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  compatibility?: {
    claudeCode: boolean;
    maestroAgentica: boolean;
    genericRuntime: boolean;
  };
  metadata?: {
    name: string;
    description: string;
    version: string;
    triggers: string[];
    hasScripts: boolean;
    hasSamples: boolean;
    hasTests: boolean;
    hasReadme: boolean;
  };
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Development: <Code2 className="h-5 w-5" />,
  Testing: <TestTube className="h-5 w-5" />,
  Documentation: <FileText className="h-5 w-5" />,
  Data: <Database className="h-5 w-5" />,
  Security: <Shield className="h-5 w-5" />,
  AI: <Brain className="h-5 w-5" />,
  Design: <Paintbrush className="h-5 w-5" />,
  Custom: <Lightbulb className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Development: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
  Testing: "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400",
  Documentation: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
  Data: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
  Security: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400",
  AI: "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400",
  Design: "bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400",
  Custom: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({
    name: "",
    description: "",
    content: "",
    category: "Custom",
  });
  const [generatorPrompt, setGeneratorPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      // failed
    } finally {
      setLoading(false);
    }
  };

  const handleExportSkill = async (skill: Skill) => {
    try {
      const res = await fetch("/api/skills/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skill.name,
          description: skill.description,
          content: skill.content,
          category: skill.category,
          version: skill.version,
          triggers: skill.triggers,
        }),
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.download = `${slug}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopied(skill.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // export failed
    }
  };

  const handleImportSkill = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportWarnings([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/skills/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const details = data.details?.join("; ") || data.error || "Failed to import skill.";
        throw new Error(details);
      }

      // Show warnings if any
      if (data.validation?.warnings?.length > 0) {
        setImportWarnings(data.validation.warnings);
      }

      setSkills((prev) => [...prev, data.skill]);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import skill.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleValidatePackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/skills/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setValidationResult(data);
      } else {
        setValidationResult({
          valid: false,
          errors: [data.error || "Validation failed"],
          warnings: [],
        });
      }
      setValidationOpen(true);
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [err instanceof Error ? err.message : "Validation failed"],
        warnings: [],
      });
      setValidationOpen(true);
    } finally {
      setValidating(false);
      if (validateInputRef.current) {
        validateInputRef.current.value = "";
      }
    }
  };

  const handleCreate = async () => {
    if (!newSkill.name.trim() || !newSkill.content.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkill),
      });
      if (res.ok) {
        const created = await res.json();
        setSkills((prev) => [...prev, created]);
        setCreateOpen(false);
        setNewSkill({ name: "", description: "", content: "", category: "Custom" });
      }
    } catch {
      // failed
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!generatorPrompt.trim()) return;
    setGenerating(true);

    const kebabName = generatorPrompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

    const generatedContent = `---
name: ${kebabName}
description: ${generatorPrompt}
version: 1.0.0
triggers:
  - "${generatorPrompt.toLowerCase()}"
type: skill
---

# ${generatorPrompt}

## Instructions
Based on the description: "${generatorPrompt}"

## Guidelines
- Follow best practices for this domain
- Provide clear, actionable instructions
- Include examples where appropriate
- Consider edge cases and error scenarios

## Output Format
- Structure responses clearly with headings
- Use bullet points for lists
- Include code examples in fenced code blocks

---
*This skill was auto-generated. Edit the content above to customize it for your specific needs.*`;

    setNewSkill({
      name: generatorPrompt.slice(0, 50),
      description: generatorPrompt,
      content: generatedContent,
      category: "Custom",
    });
    setGenerating(false);
    setGeneratorOpen(false);
    setCreateOpen(true);
    setGeneratorPrompt("");
  };

  const categories = ["all", ...Array.from(new Set(skills.map((s) => s.category)))];

  const filtered = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
      <Header title="Skills" description="Browse and create interoperable skills compatible with Claude Code and other agent runtimes">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGeneratorOpen(true)}>
            <Zap className="mr-2 h-4 w-4" /> Skill Creator
          </Button>
          <Button variant="outline" onClick={() => validateInputRef.current?.click()} disabled={validating}>
            {validating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
            ) : (
              <><Package className="mr-2 h-4 w-4" /> Validate Package</>
            )}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Import Skill</>
            )}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Skill
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImportSkill}
            className="hidden"
          />
          <input
            ref={validateInputRef}
            type="file"
            accept=".zip"
            onChange={handleValidatePackage}
            className="hidden"
          />
        </div>
      </Header>

      {/* Import error */}
      {importError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {importError}
          <button onClick={() => setImportError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Import warnings */}
      {importWarnings.length > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Import completed with warnings:</span>
            <button onClick={() => setImportWarnings([])} className="ml-auto text-xs underline">Dismiss</button>
          </div>
          <ul className="list-disc list-inside text-xs space-y-0.5 ml-6">
            {importWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-md bg-muted/50 border px-4 py-3 flex gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Skills follow the SKILL.md standard and are interoperable with Claude Code, GitHub, and other compatible agent runtimes. Import .zip packages from any source or export for use elsewhere.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skills Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((skill) => {
          const isExpanded = expandedId === skill.id;
          const isCopied = copied === skill.id;

          return (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2.5 ${CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.Custom}`}>
                      {CATEGORY_ICONS[skill.category] || <Sparkles className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{skill.name}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {skill.category}
                        </Badge>
                        {skill.version && (
                          <Badge variant="secondary" className="text-[10px]">
                            v{skill.version}
                          </Badge>
                        )}
                        {skill.isImported && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                            Imported
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs mt-2">
                  {skill.description}
                </CardDescription>
                {skill.triggers && skill.triggers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {skill.triggers.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-end gap-3">
                {/* Skill content preview */}
                <div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    View content
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {skill.content}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Export button */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleExportSkill(skill)}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Exported
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Skill
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No skills found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or create a new skill.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Skill Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Skill</DialogTitle>
            <DialogDescription>
              Skills follow the SKILL.md standard with YAML frontmatter. Exported skills are compatible with Claude Code and other agent runtimes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Skill Name</Label>
                <Input
                  placeholder="e.g., My Custom Skill"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newSkill.category}
                  onValueChange={(v) => setNewSkill((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Development">Development</SelectItem>
                    <SelectItem value="Testing">Testing</SelectItem>
                    <SelectItem value="Documentation">Documentation</SelectItem>
                    <SelectItem value="Data">Data</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="AI">AI</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief description of what this skill does"
                value={newSkill.description}
                onChange={(e) => setNewSkill((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Skill Content (SKILL.md with YAML frontmatter)</Label>
              <Textarea
                placeholder={`---\nname: my-skill\ndescription: What this skill does\nversion: 1.0.0\ntriggers:\n  - "my trigger"\ntype: skill\n---\n\n# My Skill\n\nInstructions and guidelines...`}
                className="font-mono text-sm"
                rows={14}
                value={newSkill.content}
                onChange={(e) => setNewSkill((p) => ({ ...p, content: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newSkill.name.trim() || !newSkill.content.trim()}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skill Creator / Generator Dialog */}
      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Skill Creator
            </DialogTitle>
            <DialogDescription>
              Describe the skill you need and we&apos;ll generate a template for you to customize.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What should this skill do?</Label>
              <Textarea
                placeholder="e.g., Review TypeScript code for React best practices and accessibility compliance"
                rows={4}
                value={generatorPrompt}
                onChange={(e) => setGeneratorPrompt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGeneratorOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !generatorPrompt.trim()}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Generate Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Result Dialog */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Package Validation
            </DialogTitle>
            <DialogDescription>
              Compatibility check against the SKILL.md standard.
            </DialogDescription>
          </DialogHeader>
          {validationResult && (
            <div className="space-y-4">
              {/* Overall status */}
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                validationResult.valid
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}>
                {validationResult.valid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {validationResult.valid ? "Package is valid and ready to use" : "Package has validation errors"}
              </div>

              {/* Metadata */}
              {validationResult.metadata && (
                <div className="rounded-md border p-3 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Package Details</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-mono">{validationResult.metadata.name || "—"}</span>
                    <span className="text-muted-foreground">Version:</span>
                    <span>{validationResult.metadata.version || "—"}</span>
                    <span className="text-muted-foreground">Scripts:</span>
                    <span>{validationResult.metadata.hasScripts ? "Yes" : "No"}</span>
                    <span className="text-muted-foreground">Samples:</span>
                    <span>{validationResult.metadata.hasSamples ? "Yes" : "No"}</span>
                    <span className="text-muted-foreground">Tests:</span>
                    <span>{validationResult.metadata.hasTests ? "Yes" : "No"}</span>
                    <span className="text-muted-foreground">README:</span>
                    <span>{validationResult.metadata.hasReadme ? "Yes" : "No"}</span>
                  </div>
                </div>
              )}

              {/* Compatibility */}
              {validationResult.compatibility && (
                <div className="rounded-md border p-3 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Runtime Compatibility</div>
                  <div className="space-y-1">
                    {[
                      { label: "Claude Code", ok: validationResult.compatibility.claudeCode },
                      { label: "Maestro Agentica", ok: validationResult.compatibility.maestroAgentica },
                      { label: "Generic Runtime", ok: validationResult.compatibility.genericRuntime },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        {ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400">Errors</div>
                  <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-0.5">
                    {validationResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Warnings</div>
                  <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                    {validationResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
