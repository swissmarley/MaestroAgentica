"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  Coins,
  Zap,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MetricsData {
  summary: {
    avgResponseTime: number;
    totalTokens: number;
    totalCost: number;
    successRate: number;
    totalRequests: number;
  };
  timeline: Array<{
    time: string;
    responseTime: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
  }>;
}

const emptyMetrics: MetricsData = {
  summary: { avgResponseTime: 0, totalTokens: 0, totalCost: 0, successRate: 0, totalRequests: 0 },
  timeline: [],
};

export default function MetricsPage() {
  const params = useParams();
  const id = params.id as string;
  const [period, setPeriod] = useState("24h");
  const [metrics, setMetrics] = useState<MetricsData>(emptyMetrics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/agents/${id}/metrics?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data?.summary ? data : emptyMetrics);
        } else {
          setMetrics(emptyMetrics);
        }
      } catch {
        setMetrics(emptyMetrics);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, period]);

  const hasData = metrics.summary.totalRequests > 0;

  const statCards = [
    {
      title: "Avg Response Time",
      value: hasData ? `${(metrics.summary.avgResponseTime / 1000).toFixed(1)}s` : "--",
      icon: Clock,
      color: "text-blue-500",
    },
    {
      title: "Total Tokens",
      value: hasData ? metrics.summary.totalTokens.toLocaleString() : "--",
      icon: Zap,
      color: "text-amber-500",
    },
    {
      title: "Total Cost",
      value: hasData ? `$${metrics.summary.totalCost.toFixed(2)}` : "--",
      icon: Coins,
      color: "text-green-500",
    },
    {
      title: "Success Rate",
      value: hasData ? `${metrics.summary.successRate.toFixed(1)}%` : "--",
      icon: CheckCircle2,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance Metrics</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No metrics yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Metrics will appear here after the agent processes requests in the playground or deployments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke="hsl(221, 83%, 53%)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="inputTokens" fill="hsl(221, 83%, 53%)" name="Input" />
                    <Bar dataKey="outputTokens" fill="hsl(142, 71%, 45%)" name="Output" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Cost Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="hsl(142, 71%, 45%)"
                      fill="hsl(142, 71%, 45%)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
