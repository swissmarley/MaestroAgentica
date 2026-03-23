import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AgentStatusGrid } from "@/components/dashboard/agent-status-grid";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      <Header
        title="Dashboard"
        description="Overview of your AI agents and platform usage"
      />

      <StatsCards />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <UsageChart />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>

      <AgentStatusGrid />
    </div>
  );
}
