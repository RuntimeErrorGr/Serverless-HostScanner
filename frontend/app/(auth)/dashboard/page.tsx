"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Target, Clock, Server, BarChartIcon } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useThemeColors } from "@/hooks/use-theme-colors"
import { useEffect, useState } from "react"
import { dashboardAPI } from "@/lib/api"

// Types for dashboard data
interface DashboardStats {
  totalTargets: number
  averageScansPerTarget: number
  averageScanTime: string
  activeScans: number
  pendingScans: number
  runningScans: number
  deltas: {
    totalTargets: number
    averageScansPerTarget: number
    averageScanTime: string
  }
}

interface ScanActivityData {
  name: string
  value: number
}

interface VulnerabilityTrendsData {
  name: string
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

interface PortData {
  name: string
  value: number
}

interface ProtocolData {
  name: string
  value: number
}

// Empty state component for charts
function EmptyChart({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
      <BarChartIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2">{description}</p>
    </div>
  )
}


export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [scanActivity, setScanActivity] = useState<ScanActivityData[]>([])
  const [vulnerabilityTrends, setVulnerabilityTrends] = useState<VulnerabilityTrendsData[]>([])
  const [openPorts, setOpenPorts] = useState<PortData[]>([])
  const [services, setServices] = useState<ProtocolData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { chartColors, pieColors, lineColors, barColors, gridColor, textColor, isDarkMode } = useThemeColors()
  
  // Severity colors for vulnerability trends
  const severityColors = {
    critical: "#dc2626", // red-600
    high: "#ea580c", // orange-600
    medium: "#ca8a04", // yellow-600
    low: "#2563eb", // blue-600
    info: "#6b7280", // gray-500
  }

  // Enhanced tooltip colors for better elegance
  const tooltipStyle = {
    backgroundColor: isDarkMode ? "#1f2937" : "#ffffff", // gray-800 : white
    color: isDarkMode ? "#f9fafb" : "#111827", // gray-50 : gray-900
    border: `1px solid ${isDarkMode ? "#374151" : "#e5e7eb"}`, // gray-700 : gray-200
    borderRadius: "8px",
    boxShadow: isDarkMode
      ? "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)"
      : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  }

  const tooltipLabelStyle = {
    color: isDarkMode ? "#d1d5db" : "#374151", // gray-300 : gray-700
    fontWeight: "500",
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all dashboard data
        const [statsData, scanActivityData, vulnerabilityTrendsData, openPortsData, servicesData] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getScanActivity(),
          dashboardAPI.getVulnerabilityTrends(),
          dashboardAPI.getOpenPorts(),
          dashboardAPI.getServices(),
        ])

        setStats(statsData)
        setScanActivity(scanActivityData)
        setVulnerabilityTrends(vulnerabilityTrendsData)
        setOpenPorts(openPortsData)
        setServices(servicesData)
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err)
        setError("Failed to load dashboard data")

        // Fallback to mock data for development
        setStats({
          totalTargets: 156,
          averageScansPerTarget: 3.2,
          averageScanTime: "2m 45s",
          activeScans: 3,
          pendingScans: 2,
          runningScans: 1,
          deltas: {
            totalTargets: 12,
            averageScansPerTarget: 0.5,
            averageScanTime: "-15s",
          },
        })
        setScanActivity([
          { name: "Jan", value: 12 },
          { name: "Feb", value: 19 },
          { name: "Mar", value: 15 },
          { name: "Apr", value: 27 },
          { name: "May", value: 32 },
          { name: "Jun", value: 24 },
          { name: "Jul", value: 38 },
        ])
        setVulnerabilityTrends([
          { name: "Jan", critical: 2, high: 5, medium: 8, low: 12, info: 15 },
          { name: "Feb", critical: 3, high: 7, medium: 12, low: 18, info: 22 },
          { name: "Mar", critical: 1, high: 4, medium: 15, low: 25, info: 28 },
          { name: "Apr", critical: 4, high: 6, medium: 10, low: 20, info: 18 },
          { name: "May", critical: 2, high: 8, medium: 18, low: 30, info: 35 },
          { name: "Jun", critical: 1, high: 3, medium: 12, low: 22, info: 25 },
          { name: "Jul", critical: 3, high: 5, medium: 14, low: 28, info: 32 },
        ])
        setOpenPorts([
          { name: "Port 80", value: 124 },
          { name: "Port 443", value: 98 },
          { name: "Port 22", value: 76 },
          { name: "Port 21", value: 45 },
          { name: "Port 3389", value: 32 },
        ])
        setServices([
          { name: "HTTP", value: 124 },
          { name: "HTTPS", value: 98 },
          { name: "SSH", value: 76 },
          { name: "FTP", value: 45 },
          { name: "RDP", value: 32 },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const isEmptyStats = !stats

  // scan activity is empty if all values are 0
  const isEmptyScanActivity = scanActivity.every((item) => item.value === 0)

  const isEmptyVulnerabilityTrends = vulnerabilityTrends.length === 0
  const isEmptyOpenPorts = openPorts.length === 0
  const isEmptyServices = services.length === 0

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your network scanning activities</p>
        {error && <p className="text-sm text-muted-foreground mt-1">Using fallback data due to connection issues</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTargets || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.deltas.totalTargets && stats?.deltas.totalTargets > 0 ? "+" : ""}
              {stats?.deltas.totalTargets || 0} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Scans Per Target</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.averageScansPerTarget || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.deltas.averageScansPerTarget && stats?.deltas.averageScansPerTarget > 0 ? "+" : ""}
              {stats?.deltas.averageScansPerTarget || 0} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Scan Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.averageScanTime || "0s"}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.deltas.averageScanTime || "0s"} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeScans || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingScans || 0} pending, {stats?.runningScans || 0} running
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scan Activity</CardTitle>
                <CardDescription>Number of scans performed per month</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmptyScanActivity ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={scanActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} />
                      <YAxis stroke={textColor} />
                      <Tooltip
                        formatter={(value) => [`${value}`, "Scans"]}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Legend wrapperStyle={{ color: textColor }} />
                      <Bar dataKey="value" name="Scans" fill={barColors.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart
                    title="No scan activity data"
                    description="Start running scans to see activity data here"
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Trends</CardTitle>
                <CardDescription>Vulnerabilities discovered over time by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmptyVulnerabilityTrends ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={vulnerabilityTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="name" stroke={textColor} />
                      <YAxis stroke={textColor} />
                      <Tooltip
                        formatter={(value, name) => [`${value}`, name?.toString().toUpperCase()]}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Legend wrapperStyle={{ color: textColor }} />
                      <Line
                        type="monotone"
                        dataKey="critical"
                        name="Critical"
                        stroke={severityColors.critical}
                        strokeWidth={2}
                        dot={{ fill: severityColors.critical, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        name="High"
                        stroke={severityColors.high}
                        strokeWidth={2}
                        dot={{ fill: severityColors.high, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="medium"
                        name="Medium"
                        stroke={severityColors.medium}
                        strokeWidth={2}
                        dot={{ fill: severityColors.medium, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="low"
                        name="Low"
                        stroke={severityColors.low}
                        strokeWidth={2}
                        dot={{ fill: severityColors.low, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="info"
                        name="Info"
                        stroke={severityColors.info}
                        strokeWidth={2}
                        dot={{ fill: severityColors.info, strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart title="No vulnerability data" description="Complete scans to see vulnerability trends" />
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open Ports Distribution</CardTitle>
                <CardDescription>Most common open ports discovered</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmptyOpenPorts ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={openPorts}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {openPorts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}`, "Count"]}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Legend wrapperStyle={{ color: textColor }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart title="No port data" description="Complete scans to see open ports distribution" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Services Distribution</CardTitle>
                <CardDescription>Most common services discovered</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmptyServices ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={services}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {services.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}`, "Count"]}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Legend wrapperStyle={{ color: textColor }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart title="No service data" description="Complete scans to see service distribution" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Statistics</CardTitle>
              <CardDescription>Comprehensive statistics about your network scanning activities</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Detailed statistics will be available soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
