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
        "flex h-screen flex-col border-r transition-all duration-300 ease-in-out",
        "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]",
        "border-[hsl(var(--sidebar-border))]",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[hsl(var(--sidebar-border))] px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-4.5 w-4.5" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight">Maestro Agentica</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                  : "text-muted-foreground hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 space-y-1">
        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={sidebarCollapsed ? "icon" : "default"}
              onClick={toggleTheme}
              className={cn(
                "w-full text-muted-foreground hover:text-foreground",
                !sidebarCollapsed && "justify-start gap-3 px-3"
              )}
            >
              {darkMode ? (
                <Sun className="h-5 w-5 shrink-0" />
              ) : (
                <Moon className="h-5 w-5 shrink-0" />
              )}
              {!sidebarCollapsed && (
                <span className="text-sm">{darkMode ? "Light Mode" : "Dark Mode"}</span>
              )}
            </Button>
          </TooltipTrigger>
          {sidebarCollapsed && (
            <TooltipContent side="right">
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
                "w-full text-muted-foreground hover:text-foreground",
                !sidebarCollapsed && "justify-start gap-3 px-3"
              )}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-5 w-5 shrink-0" />
              ) : (
                <PanelLeftClose className="h-5 w-5 shrink-0" />
              )}
              {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
            </Button>
          </TooltipTrigger>
          {sidebarCollapsed && (
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
