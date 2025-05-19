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

// Mock data for dashboard
const mockData = {
  totalTargets: 156,
  averageScansPerTarget: 3.2,
  averageScanTime: "2m 45s",
  openPortsData: [
    { name: "Port 80", value: 124 },
    { name: "Port 443", value: 98 },
    { name: "Port 22", value: 76 },
    { name: "Port 21", value: 45 },
    { name: "Port 3389", value: 32 },
  ],
  protocolsData: [
    { name: "HTTP", value: 124 },
    { name: "HTTPS", value: 98 },
    { name: "SSH", value: 76 },
    { name: "FTP", value: 45 },
    { name: "RDP", value: 32 },
  ],
  scanActivityData: [
    { name: "Jan", value: 12 },
    { name: "Feb", value: 19 },
    { name: "Mar", value: 15 },
    { name: "Apr", value: 27 },
    { name: "May", value: 32 },
    { name: "Jun", value: 24 },
    { name: "Jul", value: 38 },
  ],
  vulnerabilityTrendData: [
    { name: "Jan", value: 5 },
    { name: "Feb", value: 8 },
    { name: "Mar", value: 12 },
    { name: "Apr", value: 7 },
    { name: "May", value: 15 },
    { name: "Jun", value: 9 },
    { name: "Jul", value: 11 },
  ],
}

// Colors for charts
const COLORS = ["#000000", "#333333", "#555555", "#777777", "#999999"]

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
  // For testing empty state, set this to true
  const isEmpty = false

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your network scanning activities</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.totalTargets}</div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Scans Per Target</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.averageScansPerTarget}</div>
            <p className="text-xs text-muted-foreground">+0.5 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Scan Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.averageScanTime}</div>
            <p className="text-xs text-muted-foreground">-15s from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">2 pending, 1 running</p>
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
                {!isEmpty ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockData.scanActivityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} scans`, "Scans"]} />
                      <Legend />
                      <Bar dataKey="value" name="Scans" fill="#000000" />
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
                <CardDescription>Vulnerabilities discovered over time</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmpty ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockData.vulnerabilityTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} vulnerabilities`, "Vulnerabilities"]} />
                      <Legend />
                      <Line type="monotone" dataKey="value" name="Vulnerabilities" stroke="#000000" strokeWidth={2} />
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
                {!isEmpty ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={mockData.openPortsData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {mockData.openPortsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} instances`, "Count"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart title="No port data" description="Complete scans to see open ports distribution" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Protocol Distribution</CardTitle>
                <CardDescription>Most common protocols discovered</CardDescription>
              </CardHeader>
              <CardContent>
                {!isEmpty ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={mockData.protocolsData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {mockData.protocolsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} instances`, "Count"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart title="No protocol data" description="Complete scans to see protocol distribution" />
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
