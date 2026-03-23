"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  ArrowLeft,
  Check,
  RotateCcw,
  Pencil,
  ChevronDown,
  ChevronUp,
  Globe,
  Wrench,
  Brain,
  Thermometer,
  Repeat,
  Cpu,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GeneratedConfig {
  name: string;
  description: string;
  icon: string;
  tags: string[];
  definition: {
    model: string;
    systemPrompt: string;
    tools: string[];
    skills: string[];
    maxTurns: number;
    temperature: number;
    webSearchEnabled: boolean;
  };
  reasoning: string;
}

type BuilderPhase = "chat" | "preview" | "creating";

// ── Constants ──────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  github: "GitHub",
  slack: "Slack",
  filesystem: "Filesystem",
  postgres: "PostgreSQL",
  "brave-search": "Brave Search",
  "google-drive": "Google Drive",
  memory: "Memory",
  puppeteer: "Puppeteer",
};

const SKILL_LABELS: Record<string, string> = {
  "code-review": "Code Review",
  "api-designer": "API Designer",
  "test-writer": "Test Writer",
  "docs-writer": "Documentation Writer",
  "sql-expert": "SQL Expert",
  "security-auditor": "Security Auditor",
  "refactoring-guide": "Refactoring Guide",
  "prompt-engineer": "Prompt Engineer",
};

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-4-5-20241022": "Claude Sonnet 4.5",
  "claude-opus-4-5-20250520": "Claude Opus 4.5",
};

const STARTER_PROMPTS = [
  "A customer support agent that handles billing questions and refund requests",
  "A code review assistant that checks PRs for bugs, security issues, and style",
  "A research agent that searches the web and summarizes findings into reports",
  "A DevOps agent that monitors deployments and helps debug infrastructure issues",
];

// ── Component ──────────────────────────────────────────────────────────

export default function AgentBuilderPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<BuilderPhase>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [editableConfig, setEditableConfig] = useState<GeneratedConfig | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isGenerating) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInputValue("");
      setIsGenerating(true);
      setError("");

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/agent-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const data = await res.json();

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (data.agentConfig) {
          setGeneratedConfig(data.agentConfig);
          setEditableConfig(JSON.parse(JSON.stringify(data.agentConfig)));
          setPhase("preview");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [messages, isGenerating]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleRegenerate = () => {
    setPhase("chat");
    setGeneratedConfig(null);
    setEditableConfig(null);
    sendMessage("Please regenerate the agent configuration with a different approach. Try varying the tools, skills, or system prompt style.");
  };

  const handleBackToChat = () => {
    setPhase("chat");
    setGeneratedConfig(null);
    setEditableConfig(null);
  };

  const handleConfirmCreate = async () => {
    if (!editableConfig) return;

    setIsCreating(true);
    setPhase("creating");
    setError("");

    try {
      // 1. Fetch full skill content from the skills API
      const skillsRes = await fetch("/api/skills");
      const skillsData = await skillsRes.json();
      const skillsCatalog = (skillsData.skills || []) as Array<{
        id: string;
        name: string;
        content: string;
      }>;

      const fullSkills = editableConfig.definition.skills.map((skillId) => {
        const catalogSkill = skillsCatalog.find((s) => s.id === skillId);
        return {
          name: catalogSkill?.name || SKILL_LABELS[skillId] || skillId,
          content: catalogSkill?.content || "",
          enabled: true,
        };
      });

      // 2. Fetch tool definitions to include as actual tool schemas
      const toolsRes = await fetch("/api/tools");
      const toolsData = await toolsRes.json();
      const toolsCatalog = (toolsData.connectors || []) as Array<{
        id: string;
        name: string;
        description: string;
        tools: string[];
        mcpEndpoint: string;
      }>;

      const mcpServers = editableConfig.definition.tools.map((toolId) => {
        const catalogTool = toolsCatalog.find((t) => t.id === toolId);
        return {
          name: catalogTool?.name || TOOL_LABELS[toolId] || toolId,
          url: catalogTool?.mcpEndpoint || "",
          enabled: true,
        };
      });

      // 3. Create the agent with full definition
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editableConfig.name,
          description: editableConfig.description,
          definition: {
            model: editableConfig.definition.model,
            systemPrompt: editableConfig.definition.systemPrompt,
            tools: [],
            maxTurns: editableConfig.definition.maxTurns,
            temperature: editableConfig.definition.temperature,
            webSearchEnabled: editableConfig.definition.webSearchEnabled,
            skills: fullSkills,
            mcpServers,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create agent");
      }

      const agent = await res.json();

      // 4. Attach tools to the agent in the DB
      await Promise.all(
        editableConfig.definition.tools.map((toolId) =>
          fetch(`/api/agents/${agent.id}/tools`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolId }),
          })
        )
      );

      // 5. Attach skills to the agent in the DB
      await Promise.all(
        editableConfig.definition.skills.map((skillId) =>
          fetch(`/api/agents/${agent.id}/skills`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skillId }),
          })
        )
      );

      router.push(`/agents/${agent.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create agent";
      setError(message);
      setPhase("preview");
    } finally {
      setIsCreating(false);
    }
  };

  const updateConfig = (path: string, value: unknown) => {
    if (!editableConfig) return;
    setEditableConfig((prev) => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = updated as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 lg:px-8 lg:pt-8">
        <Header
          title="Agent Builder"
          description="Describe what you need and AI will build your agent"
        >
          <Button variant="outline" asChild>
            <Link href="/agents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Link>
          </Button>
        </Header>
      </div>

      {error && (
        <div className="mx-6 lg:mx-8 mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {phase === "chat" && (
        <ChatPhase
          messages={messages}
          inputValue={inputValue}
          isGenerating={isGenerating}
          chatEndRef={chatEndRef}
          inputRef={inputRef}
          onInputChange={setInputValue}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onStarterClick={(prompt) => {
            setInputValue(prompt);
            sendMessage(prompt);
          }}
        />
      )}

      {(phase === "preview" || phase === "creating") && editableConfig && (
        <PreviewPhase
          config={editableConfig}
          isCreating={isCreating}
          showSystemPrompt={showSystemPrompt}
          onToggleSystemPrompt={() => setShowSystemPrompt((p) => !p)}
          onUpdateConfig={updateConfig}
          onConfirm={handleConfirmCreate}
          onRegenerate={handleRegenerate}
          onBack={handleBackToChat}
          reasoning={generatedConfig?.reasoning || ""}
        />
      )}
    </div>
  );
}

// ── Chat Phase ─────────────────────────────────────────────────────────

function ChatPhase({
  messages,
  inputValue,
  isGenerating,
  chatEndRef,
  inputRef,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStarterClick,
}: {
  messages: ChatMessage[];
  inputValue: string;
  isGenerating: boolean;
  chatEndRef: React.MutableRefObject<HTMLDivElement | null>;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStarterClick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col min-h-0 px-6 lg:px-8 pb-6">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 min-h-0">
        {messages.length === 0 && (
          <EmptyState onStarterClick={onStarterClick} />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isGenerating && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-lg bg-muted px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={onSubmit} className="shrink-0">
        <div className="relative flex items-end gap-2 rounded-lg border bg-background p-2 shadow-sm">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe the agent you want to build..."
            className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
            rows={1}
            disabled={isGenerating}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !inputValue.trim()}
            className="shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-center text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState({ onStarterClick }: { onStarterClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
        <Wand2 className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        What kind of agent do you want to build?
      </h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Describe your agent in plain language. The AI will figure out the best
        model, tools, skills, and system prompt for you.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 max-w-2xl w-full">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onStarterClick(prompt)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Sparkles className="h-4 w-4 text-primary mb-2" />
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-4 py-3 max-w-[75%] text-sm leading-relaxed whitespace-pre-wrap",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

// ── Preview Phase ──────────────────────────────────────────────────────

function PreviewPhase({
  config,
  isCreating,
  showSystemPrompt,
  onToggleSystemPrompt,
  onUpdateConfig,
  onConfirm,
  onRegenerate,
  onBack,
  reasoning,
}: {
  config: GeneratedConfig;
  isCreating: boolean;
  showSystemPrompt: boolean;
  onToggleSystemPrompt: () => void;
  onUpdateConfig: (path: string, value: unknown) => void;
  onConfirm: () => void;
  onRegenerate: () => void;
  onBack: () => void;
  reasoning: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header banner */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Agent configuration generated</p>
            <p className="text-sm text-muted-foreground mt-1">
              Review the setup below. You can edit any field before creating the agent.
            </p>
          </div>
        </div>

        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{config.icon}</div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  value={config.name}
                  onChange={(e) => onUpdateConfig("name", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-desc">Description</Label>
              <Textarea
                id="agent-desc"
                value={config.description}
                onChange={(e) => onUpdateConfig("description", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {config.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model & Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Model & Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Model
                </Label>
                <Select
                  value={config.definition.model}
                  onValueChange={(v) => onUpdateConfig("definition.model", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                    <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
                    <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5" />
                  Temperature
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.definition.temperature}
                  onChange={(e) =>
                    onUpdateConfig("definition.temperature", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  Max Turns
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={config.definition.maxTurns}
                  onChange={(e) =>
                    onUpdateConfig("definition.maxTurns", parseInt(e.target.value) || 1)
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Web Search</p>
                  <p className="text-xs text-muted-foreground">Allow the agent to search the web</p>
                </div>
              </div>
              <Switch
                checked={config.definition.webSearchEnabled}
                onCheckedChange={(v) => onUpdateConfig("definition.webSearchEnabled", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        {config.definition.tools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Tools
                <Badge variant="secondary" className="ml-auto">{config.definition.tools.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {config.definition.tools.map((toolId) => (
                  <Badge
                    key={toolId}
                    variant="outline"
                    className="px-3 py-1.5 text-sm"
                  >
                    <Wrench className="h-3 w-3 mr-1.5" />
                    {TOOL_LABELS[toolId] || toolId}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {config.definition.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Skills
                <Badge variant="secondary" className="ml-auto">{config.definition.skills.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {config.definition.skills.map((skillId) => (
                  <Badge
                    key={skillId}
                    variant="outline"
                    className="px-3 py-1.5 text-sm"
                  >
                    <Brain className="h-3 w-3 mr-1.5" />
                    {SKILL_LABELS[skillId] || skillId}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Prompt */}
        <Card>
          <CardHeader>
            <button
              onClick={onToggleSystemPrompt}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                System Prompt
              </CardTitle>
              {showSystemPrompt ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {showSystemPrompt && (
            <CardContent>
              <Textarea
                value={config.definition.systemPrompt}
                onChange={(e) =>
                  onUpdateConfig("definition.systemPrompt", e.target.value)
                }
                rows={12}
                className="font-mono text-sm"
              />
            </CardContent>
          )}
        </Card>

        {/* AI Reasoning */}
        {reasoning && (
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              AI Reasoning
            </p>
            <p className="text-sm text-muted-foreground">{reasoning}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Chat
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onRegenerate} disabled={isCreating}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button onClick={onConfirm} disabled={isCreating || !config.name.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Agent
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
