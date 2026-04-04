"use client";

import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Header({ title, description, children, className }: HeaderProps) {
  return (
    <div className={cn("animate-fade-in", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">{title}</span>
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "100ms" }}>
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: "150ms" }}>
            {children}
          </div>
        )}
      </div>
      {/* Gradient separator */}
      <div className="mt-5 h-px w-full bg-gradient-to-r from-[hsl(var(--gradient-start)/0.3)] via-[hsl(var(--gradient-end)/0.2)] to-transparent" />
    </div>
  );
}
