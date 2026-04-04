"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  Store,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Brain,
  Wrench,
  Sparkles,
  Wand2,
  Activity,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui-store";
import { useCallback, useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent-builder", label: "Agent Builder", icon: Wand2 },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/playground", label: "Playground", icon: MessageSquare },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/diagnostics", label: "Diagnostics", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useUIStore();
  const darkMode = theme === "dark";

  useEffect(() => {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(darkMode ? "light" : "dark");
  }, [darkMode, setTheme]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative z-20 flex h-screen flex-col border-r transition-all duration-300 ease-out-expo",
        "glass-strong",
        "border-[hsl(var(--sidebar-border))]",
        sidebarCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4">
        <Link href="/" className="flex items-center gap-3 overflow-hidden group">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-glow transition-transform duration-200 ease-out-expo group-hover:scale-105">
            <Bot className="h-[18px] w-[18px]" />
            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in">
              <span className="text-base font-bold tracking-tight gradient-text">
                Maestro
              </span>
              <span className="text-base font-bold tracking-tight text-foreground ml-1">
                Agentica
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200 ease-out-expo",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)]",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              {/* Active background indicator */}
              {active && (
                <div className="absolute inset-0 rounded-xl gradient-primary opacity-90 shadow-glow animate-fade-in-scale" />
              )}
              <item.icon
                className={cn(
                  "relative z-10 h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out-expo",
                  !active && "group-hover:scale-110"
                )}
              />
              {!sidebarCollapsed && (
                <span className="relative z-10">{item.label}</span>
              )}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="font-medium glass-strong rounded-lg border-[hsl(var(--glass-border))]"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 space-y-0.5">
        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              onClick={toggleTheme}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground rounded-xl transition-all duration-200 ease-out-expo",
                "hover:bg-[hsl(var(--foreground)/0.04)]",
                !sidebarCollapsed && "justify-start gap-3 px-3"
              )}
            >
              {darkMode ? (
                <Sun className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-out-expo hover:rotate-45" />
              ) : (
                <Moon className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-out-expo hover:-rotate-12" />
              )}
              {!sidebarCollapsed && (
                <span className="text-sm">{darkMode ? "Light Mode" : "Dark Mode"}</span>
              )}
            </Button>
          </TooltipTrigger>
          {sidebarCollapsed && (
            <TooltipContent side="right" className="font-medium">
              {darkMode ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          )}
        </Tooltip>

        {/* Collapse toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              onClick={toggleSidebar}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground rounded-xl transition-all duration-200 ease-out-expo",
                "hover:bg-[hsl(var(--foreground)/0.04)]",
                !sidebarCollapsed && "justify-start gap-3 px-3"
              )}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-[18px] w-[18px] shrink-0" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
              )}
              {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
            </Button>
          </TooltipTrigger>
          {sidebarCollapsed && (
            <TooltipContent side="right" className="font-medium">
              Expand sidebar
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
