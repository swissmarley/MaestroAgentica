"use client";

import { useState } from "react";
import { Copy, Check, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolCallCard } from "./tool-call-card";
import type { PlaygroundMessage } from "@/types/playground";

interface MessageBubbleProps {
  message: PlaygroundMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "system") {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-full px-4 py-1.5 border border-border/30">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 group animate-fade-in-up", isUser ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ease-out group-hover:scale-105",
          isUser
            ? "gradient-primary text-white shadow-glow"
            : "bg-muted/50 text-muted-foreground border border-border/30"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser ? "items-end" : "")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "gradient-primary text-white shadow-glow"
              : "bg-card border border-border/30 shadow-premium",
            message.isStreaming && "animate-pulse"
          )}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content || (message.isStreaming ? "..." : "")}
          </div>
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2 mt-1">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div
          className={cn(
            "flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            isUser ? "flex-row-reverse" : ""
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          {message.tokenCount && (
            <span className="text-[10px] text-muted-foreground/60">
              {message.tokenCount} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
