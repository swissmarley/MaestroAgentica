"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Trash2,
  Square,
  Copy,
  Check,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  Loader2,
  Wrench,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolCallCard } from "@/components/playground/tool-call-card";
import { cn } from "@/lib/utils";
import type { PlaygroundMessage, ToolCallInfo, SkillInfo } from "@/types/playground";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  icon?: string;
}

interface AgentVersion {
  id: string;
  version: string;
  tag?: string;
}

interface FileAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function PlaygroundPage() {
  // Agent & config state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [channel, setChannel] = useState<string>("development");
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // File attachments
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load agents on mount
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(Array.isArray(data) ? data : data.agents || []);
        }
      } catch { /* failed */ }
      finally { setLoadingAgents(false); }
    }
    loadAgents();
  }, []);

  // Load versions when agent changes
  useEffect(() => {
    if (!selectedAgentId) {
      setVersions([]);
      setSelectedVersionId("");
      return;
    }
    async function loadVersions() {
      try {
        const res = await fetch(`/api/agents/${selectedAgentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.versions?.length > 0) {
            setVersions(data.versions);
            setSelectedVersionId(data.versions[0].id);
          } else {
            setVersions([]);
            setSelectedVersionId("");
          }
        }
      } catch { /* failed */ }
    }
    loadVersions();
  }, [selectedAgentId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, toolCalls]);

  const handleCopy = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setToolCalls([]);
    setError(null);
    setAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      const attachment: FileAttachment = {
        id: generateId(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
      };
      if (file.type.startsWith("image/")) {
        attachment.preview = URL.createObjectURL(file);
      }
      newAttachments.push(attachment);
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      const attachment: FileAttachment = {
        id: generateId(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
      };
      if (file.type.startsWith("image/")) {
        attachment.preview = URL.createObjectURL(file);
      }
      newAttachments.push(attachment);
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || !selectedAgentId) return;

    // Build user message content
    let userContent = trimmed;
    if (attachments.length > 0) {
      const fileNames = attachments.map((a) => a.name).join(", ");
      userContent = trimmed
        ? `${trimmed}\n\n[Attached files: ${fileNames}]`
        : `[Attached files: ${fileNames}]`;
    }

    const userMessage: PlaygroundMessage = {
      id: generateId(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    const assistantMessageId = generateId();
    const assistantMessage: PlaygroundMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);
    setError(null);
    setToolCalls([]);
    setInput("");
    setAttachments([]);

    try {
      // Build conversation history
      const priorMessages = messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`/api/agents/${selectedAgentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userContent,
          versionId: selectedVersionId,
          history: priorMessages,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response body received");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let currentToolCalls: ToolCallInfo[] = [];
      let activeSkills: SkillInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          let event: { event: string; data: Record<string, unknown> };
          try { event = JSON.parse(dataStr); } catch { continue; }

          switch (event.event) {
            case "skills_active": {
              const skills = event.data?.skills as SkillInfo[] | undefined;
              if (skills && skills.length > 0) {
                activeSkills = skills;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, activeSkills: skills } : m
                  )
                );
              }
              break;
            }
            case "content_block_delta": {
              const delta = event.data?.delta as string | undefined;
              if (delta) {
                accumulatedContent += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m
                  )
                );
              }
              break;
            }
            case "tool_use_start": {
              const toolCall: ToolCallInfo = {
                id: (event.data?.id as string) ?? generateId(),
                name: (event.data?.name as string) ?? "unknown",
                input: (event.data?.input as Record<string, unknown>) ?? {},
                status: "running",
                startedAt: Date.now(),
              };
              currentToolCalls = [...currentToolCalls, toolCall];
              setToolCalls(currentToolCalls);
              break;
            }
            case "tool_result": {
              const toolId = event.data?.tool_use_id as string;
              const output = event.data?.output as string;
              const isError = event.data?.is_error as boolean;
              currentToolCalls = currentToolCalls.map((tc) =>
                tc.id === toolId
                  ? { ...tc, output, status: isError ? "error" as const : "completed" as const, completedAt: Date.now() }
                  : tc
              );
              setToolCalls(currentToolCalls);
              break;
            }
            case "message_stop": {
              const tokenCount = event.data?.usage as { output_tokens?: number } | undefined;
              // Mark any still-running tool calls as completed
              currentToolCalls = currentToolCalls.map((tc) =>
                tc.status === "running"
                  ? { ...tc, status: "completed" as const, completedAt: Date.now() }
                  : tc
              );
              setToolCalls(currentToolCalls);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        isStreaming: false,
                        toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
                        activeSkills: activeSkills.length > 0 ? activeSkills : m.activeSkills,
                        tokenCount: tokenCount?.output_tokens,
                      }
                    : m
                )
              );
              break;
            }
            case "error": {
              const errorMsg = (event.data?.message as string) ?? "An error occurred";
              setError(errorMsg);
              break;
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: m.content || "Error: " + message, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  // Render markdown-ish content (code blocks, bold, etc.)
  const renderContent = (content: string) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const inner = part.slice(3, -3);
        const newlineIdx = inner.indexOf("\n");
        const lang = newlineIdx > 0 ? inner.slice(0, newlineIdx).trim() : "";
        const code = newlineIdx > 0 ? inner.slice(newlineIdx + 1) : inner;
        return (
          <div key={i} className="my-2">
            {lang && <div className="text-[10px] text-muted-foreground font-mono bg-muted/80 px-3 py-1 rounded-t-md border border-b-0">{lang}</div>}
            <pre className={cn("text-xs font-mono bg-muted/50 border rounded-md p-3 overflow-x-auto whitespace-pre-wrap", lang && "rounded-t-none")}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      // Render inline bold and italic
      const formatted = part
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, '<code class="text-xs bg-muted rounded px-1 py-0.5 font-mono">$1</code>');
      return <span key={i} className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Sidebar — Config Panel */}
      <div className="w-72 border-r flex flex-col bg-muted/30 shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Chat Playground
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Test agents in real-time</p>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Agent Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Agent</label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingAgents ? "Loading..." : "Select an agent"} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5" />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAgent && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{selectedAgent.description}</p>
            )}
          </div>

          {/* Version Selection */}
          {versions.length > 1 && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Version</label>
              <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.version}{v.tag ? ` (${v.tag})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Channel Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Channel</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Development
                  </div>
                </SelectItem>
                <SelectItem value="staging">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Staging
                  </div>
                </SelectItem>
                <SelectItem value="production">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Production
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Session info */}
          {messages.length > 0 && (
            <div className="rounded-md bg-muted/50 border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Session</span>
                <Badge variant="outline" className="text-[10px]">
                  {messages.filter((m) => m.role === "user").length} turns
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {messages.length} messages
              </div>
            </div>
          )}
        </div>

        {/* New chat button */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={handleNewChat} disabled={messages.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> New Chat
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className="flex-1 flex flex-col"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            {selectedAgent ? (
              <>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{selectedAgent.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{channel}</Badge>
                    {selectedVersionId && versions.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        v{versions.find((v) => v.id === selectedVersionId)?.version || ""}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Select an agent to begin</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleNewChat}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 overflow-y-auto" ref={scrollRef}>
          {!selectedAgentId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bot className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chat Playground</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Select an agent from the sidebar to start testing. You can chat, attach files,
                and see tool usage in real-time.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">Start a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Send a message to {selectedAgent?.name}. Attach files by dragging them or using the clip icon.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-6 space-y-6 pb-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isCopied = copiedId === msg.id;

                if (msg.role === "system") {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={cn("flex gap-4 group", isUser ? "flex-row-reverse" : "")}>
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    <div className={cn("flex flex-col gap-1.5 max-w-[85%]", isUser ? "items-end" : "")}>
                      <div className="text-[11px] text-muted-foreground">
                        {isUser ? "You" : selectedAgent?.name || "Agent"}
                      </div>
                      <div
                        className={cn(
                          "rounded-xl px-4 py-3 text-sm",
                          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
                          msg.isStreaming && !msg.content && "animate-pulse"
                        )}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        ) : (
                          <div>{renderContent(msg.content || (msg.isStreaming ? "..." : ""))}</div>
                        )}
                      </div>

                      {/* Tool calls */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="w-full space-y-2 mt-1">
                          {msg.toolCalls.map((tc) => (
                            <ToolCallCard key={tc.id} toolCall={tc} />
                          ))}
                        </div>
                      )}

                      {/* Active skills */}
                      {!isUser && msg.activeSkills && msg.activeSkills.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="text-[10px] text-muted-foreground">Skills:</span>
                          {msg.activeSkills.map((skill) => (
                            <Badge key={skill.name} variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                              <Sparkles className="h-2.5 w-2.5" />
                              {skill.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity",
                          isUser ? "flex-row-reverse" : ""
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(msg.id, msg.content)}
                        >
                          {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        {msg.tokenCount && (
                          <span className="text-[10px] text-muted-foreground">
                            {msg.tokenCount} tokens
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Live tool calls */}
              {isStreaming && toolCalls.length > 0 && !messages.some((m) => m.toolCalls?.length) && (
                <div className="space-y-2 pl-13">
                  {toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {isStreaming && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground pl-2">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">{selectedAgent?.name || "Agent"} is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-center gap-2">
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        {/* File Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mx-6 mb-2 flex gap-2 flex-wrap">
            {attachments.map((att) => (
              <div key={att.id} className="relative group flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs">
                {att.preview ? (
                  <img src={att.preview} alt={att.name} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="max-w-[120px]">
                  <div className="truncate font-medium">{att.name}</div>
                  <div className="text-muted-foreground">{formatFileSize(att.size)}</div>
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 items-end">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || !selectedAgentId}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.xlsx,.xls,.csv,.txt,.json,.md,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !selectedAgentId
                    ? "Select an agent to start chatting..."
                    : "Type a message... (Enter to send, Shift+Enter for new line)"
                }
                className="min-h-[44px] max-h-[200px] resize-none"
                rows={1}
                disabled={isStreaming || !selectedAgentId}
              />
              {isStreaming ? (
                <Button variant="destructive" size="icon" className="shrink-0 h-10 w-10">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={sendMessage}
                  disabled={(!input.trim() && attachments.length === 0) || !selectedAgentId}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Drop files here or use the clip icon to attach. Enter to send, Shift+Enter for new line.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
