"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  FlaskConical,
  GitBranch,
  Rocket,
  BarChart3,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentSubNavProps {
  agentId: string;
}

const navItems = [
  { label: "Overview", href: "", icon: Settings },
  { label: "Playground", href: "/playground", icon: FlaskConical },
  { label: "Versions", href: "/versions", icon: GitBranch },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  { label: "Metrics", href: "/metrics", icon: BarChart3 },
  { label: "Logs", href: "/logs", icon: ScrollText },
];

export function AgentSubNav({ agentId }: AgentSubNavProps) {
  const pathname = usePathname();
  const basePath = `/agents/${agentId}`;

  function isActive(href: string) {
    const fullPath = basePath + href;
    if (href === "") {
      return pathname === basePath || pathname === basePath + "/";
    }
    return pathname.startsWith(fullPath);
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="flex items-center gap-1 px-4 lg:px-8 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={basePath + item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
