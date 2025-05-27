"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, LineChart } from "@/components/ui/chart"
import { formatToBucharestTime } from "@/lib/timezone"
import { adminAPI } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import {
  Users,
  BarChart,
  PieChartIcon,
  LineChartIcon,
  Server,
  Search,
  Ban,
  CheckCircle,
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStickIcon as Memory,
  Network,
  Layers,
  Zap,
  ShieldX,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"

// Mock data for testing
const mockUsers = [
  {
    id: "usr-001",
    name: "John Doe",
    email: "john@example.com",
    registeredDate: "2023-01-15T10:30:00Z",
    status: "active",
    stats: {
      scansRun: 45,
      targetsScanned: 128,
      findingsGenerated: 312,
      reportsCreated: 18,
    },
    lastActive: "2023-05-20T14:22:00Z",
  },
  {
    id: "usr-002",
    name: "Jane Smith",
    email: "jane@example.com",
    registeredDate: "2023-02-22T09:15:00Z",
    status: "active",
    stats: {
      scansRun: 32,
      targetsScanned: 87,
      findingsGenerated: 203,
      reportsCreated: 12,
    },
    lastActive: "2023-05-19T11:45:00Z",
  },
  {
    id: "usr-003",
    name: "Robert Johnson",
    email: "robert@example.com",
    registeredDate: "2023-03-10T16:45:00Z",
    status: "banned",
    banReason: "Suspicious activity",
    banExpiry: "2023-06-10T16:45:00Z",
    stats: {
      scansRun: 18,
      targetsScanned: 42,
      findingsGenerated: 97,
      reportsCreated: 5,
    },
    lastActive: "2023-05-15T08:30:00Z",
  },
  {
    id: "usr-004",
    name: "Emily Davis",
    email: "emily@example.com",
    registeredDate: "2023-04-05T11:20:00Z",
    status: "active",
    stats: {
      scansRun: 27,
      targetsScanned: 63,
      findingsGenerated: 154,
      reportsCreated: 9,
    },
    lastActive: "2023-05-21T09:15:00Z",
  },
  {
    id: "usr-005",
    name: "Michael Wilson",
    email: "michael@example.com",
    registeredDate: "2023-04-18T14:10:00Z",
    status: "active",
    stats: {
      scansRun: 12,
      targetsScanned: 35,
      findingsGenerated: 78,
      reportsCreated: 4,
    },
    lastActive: "2023-05-18T16:40:00Z",
  },
]

const mockAggregatedStats = {
  totalUsers: 156,
  totalScans: 3427,
  totalTargets: 8954,
  totalFindings: 21568,
  totalReports: 1245,
  activeScanningUsers: 87,
  scanTrends: [
    { name: "Jan", value: 210 },
    { name: "Feb", value: 245 },
    { name: "Mar", value: 290 },
    { name: "Apr", value: 310 },
    { name: "May", value: 340 },
    { name: "Jun", value: 325 },
    { name: "Jul", value: 370 },
    { name: "Aug", value: 390 },
    { name: "Sep", value: 410 },
    { name: "Oct", value: 450 },
    { name: "Nov", value: 480 },
    { name: "Dec", value: 520 },
  ],
  findingsBySeverity: [
    { name: "Critical", value: 1245, color: "#dc2626" },
    { name: "High", value: 3568, color: "#ea580c" },
    { name: "Medium", value: 5872, color: "#ca8a04" },
    { name: "Low", value: 7654, color: "#2563eb" },
    { name: "Info", value: 3229, color: "#6b7280" },
  ],
  findingsByPort: [
    { name: "Port 80 (HTTP)", value: 4521, color: "#2563eb" },
    { name: "Port 443 (HTTPS)", value: 3872, color: "#16a34a" },
    { name: "Port 22 (SSH)", value: 2543, color: "#ca8a04" },
    { name: "Port 21 (FTP)", value: 1876, color: "#dc2626" },
    { name: "Port 25 (SMTP)", value: 1245, color: "#9333ea" },
    { name: "Other Ports", value: 7511, color: "#6b7280" },
  ],
  findingsByService: [
    { name: "Web Servers", value: 7845, color: "#2563eb" },
    { name: "Databases", value: 4532, color: "#16a34a" },
    { name: "Email Services", value: 2876, color: "#ca8a04" },
    { name: "File Sharing", value: 2154, color: "#dc2626" },
    { name: "Remote Access", value: 1987, color: "#9333ea" },
    { name: "Other Services", value: 2174, color: "#6b7280" },
  ],
  userActivity: [
    { name: "Jan", value: 45 },
    { name: "Feb", value: 52 },
    { name: "Mar", value: 61 },
    { name: "Apr", value: 67 },
    { name: "May", value: 75 },
    { name: "Jun", value: 72 },
    { name: "Jul", value: 78 },
    { name: "Aug", value: 84 },
    { name: "Sep", value: 87 },
    { name: "Oct", value: 92 },
    { name: "Nov", value: 98 },
    { name: "Dec", value: 105 },
  ],
  targetDistribution: [
    { name: "Web Applications", value: 3245, color: "#2563eb" },
    { name: "Network Devices", value: 2187, color: "#16a34a" },
    { name: "Servers", value: 1876, color: "#ca8a04" },
    { name: "Cloud Resources", value: 1245, color: "#dc2626" },
    { name: "IoT Devices", value: 401, color: "#9333ea" },
  ],
  reportGeneration: [
    { name: "Jan", value: 65 },
    { name: "Feb", value: 78 },
    { name: "Mar", value: 92 },
    { name: "Apr", value: 105 },
    { name: "May", value: 118 },
    { name: "Jun", value: 110 },
    { name: "Jul", value: 125 },
    { name: "Aug", value: 132 },
    { name: "Sep", value: 140 },
    { name: "Oct", value: 152 },
    { name: "Nov", value: 165 },
    { name: "Dec", value: 178 },
  ],
  monthlyScanVolume: [
    { name: "Jan", value: 210 },
    { name: "Feb", value: 245 },
    { name: "Mar", value: 290 },
    { name: "Apr", value: 310 },
    { name: "May", value: 340 },
    { name: "Jun", value: 325 },
    { name: "Jul", value: 370 },
    { name: "Aug", value: 390 },
    { name: "Sep", value: 410 },
    { name: "Oct", value: 450 },
    { name: "Nov", value: 480 },
    { name: "Dec", value: 520 },
  ],
  findingDiscoveryRate: [
    { name: "Jan", value: 1245 },
    { name: "Feb", value: 1387 },
    { name: "Mar", value: 1542 },
    { name: "Apr", value: 1678 },
    { name: "May", value: 1845 },
    { name: "Jun", value: 1756 },
    { name: "Jul", value: 1932 },
    { name: "Aug", value: 2045 },
    { name: "Sep", value: 2187 },
    { name: "Oct", value: 2342 },
    { name: "Nov", value: 2487 },
    { name: "Dec", value: 2654 },
  ],
  platformUsageGrowth: [
    { name: "Jan", value: 45 },
    { name: "Feb", value: 52 },
    { name: "Mar", value: 61 },
    { name: "Apr", value: 67 },
    { name: "May", value: 75 },
    { name: "Jun", value: 82 },
    { name: "Jul", value: 91 },
    { name: "Aug", value: 98 },
    { name: "Sep", value: 107 },
    { name: "Oct", value: 118 },
    { name: "Nov", value: 132 },
    { name: "Dec", value: 145 },
  ],
}

const mockSystemStatus = {
  clusters: [
    {
      name: "Main Cluster",
      status: "healthy",
      nodes: 3,
      pods: 24,
      deployments: 8,
      services: 12,
      uptime: "99.98%",
      lastIncident: "2023-04-15T08:30:00Z",
    },
    {
      name: "OpenFaaS Cluster",
      status: "healthy",
      nodes: 2,
      pods: 12,
      deployments: 4,
      services: 6,
      uptime: "99.95%",
      lastIncident: "2023-05-02T14:15:00Z",
    },
  ],
  deployments: [
    { name: "frontend", cluster: "Main Cluster", replicas: 3, available: 3, status: "healthy" },
    { name: "backend-api", cluster: "Main Cluster", replicas: 3, available: 3, status: "healthy" },
    { name: "mysql", cluster: "Main Cluster", replicas: 1, available: 1, status: "healthy" },
    { name: "redis", cluster: "Main Cluster", replicas: 2, available: 2, status: "healthy" },
    { name: "celery-worker", cluster: "Main Cluster", replicas: 4, available: 4, status: "healthy" },
    { name: "celery-beat", cluster: "Main Cluster", replicas: 1, available: 1, status: "healthy" },
    { name: "gateway", cluster: "OpenFaaS Cluster", replicas: 2, available: 2, status: "healthy" },
    { name: "function-scanner", cluster: "OpenFaaS Cluster", replicas: 3, available: 3, status: "healthy" },
    { name: "prometheus", cluster: "Main Cluster", replicas: 1, available: 1, status: "healthy" },
    { name: "grafana", cluster: "Main Cluster", replicas: 1, available: 1, status: "healthy" },
  ],
  nodes: [
    { name: "node-1", cluster: "Main Cluster", status: "healthy", role: "master", cpu: 65, memory: 72, disk: 48 },
    { name: "node-2", cluster: "Main Cluster", status: "healthy", role: "worker", cpu: 78, memory: 85, disk: 62 },
    { name: "node-3", cluster: "Main Cluster", status: "healthy", role: "worker", cpu: 72, memory: 80, disk: 55 },
    { name: "node-4", cluster: "OpenFaaS Cluster", status: "healthy", role: "master", cpu: 45, memory: 58, disk: 32 },
    { name: "node-5", cluster: "OpenFaaS Cluster", status: "healthy", role: "worker", cpu: 68, memory: 75, disk: 41 },
  ],
  resourceUsage: {
    cpu: [
      { name: "00:00", main: 45, openfaas: 32 },
      { name: "02:00", main: 42, openfaas: 30 },
      { name: "04:00", main: 38, openfaas: 28 },
      { name: "06:00", main: 41, openfaas: 31 },
      { name: "08:00", main: 52, openfaas: 38 },
      { name: "10:00", main: 68, openfaas: 45 },
      { name: "12:00", main: 75, openfaas: 52 },
      { name: "14:00", main: 72, openfaas: 48 },
      { name: "16:00", main: 78, openfaas: 54 },
      { name: "18:00", main: 65, openfaas: 42 },
      { name: "20:00", main: 58, openfaas: 38 },
      { name: "22:00", main: 48, openfaas: 35 },
    ],
    memory: [
      { name: "00:00", main: 52, openfaas: 45 },
      { name: "02:00", main: 50, openfaas: 42 },
      { name: "04:00", main: 48, openfaas: 40 },
      { name: "06:00", main: 51, openfaas: 43 },
      { name: "08:00", main: 62, openfaas: 48 },
      { name: "10:00", main: 75, openfaas: 58 },
      { name: "12:00", main: 82, openfaas: 65 },
      { name: "14:00", main: 80, openfaas: 62 },
      { name: "16:00", main: 85, openfaas: 68 },
      { name: "18:00", main: 78, openfaas: 60 },
      { name: "20:00", main: 68, openfaas: 52 },
      { name: "22:00", main: 58, openfaas: 48 },
    ],
    disk: [
      { name: "00:00", main: 38, openfaas: 28 },
      { name: "02:00", main: 38, openfaas: 28 },
      { name: "04:00", main: 39, openfaas: 29 },
      { name: "06:00", main: 39, openfaas: 29 },
      { name: "08:00", main: 40, openfaas: 30 },
      { name: "10:00", main: 42, openfaas: 31 },
      { name: "12:00", main: 45, openfaas: 33 },
      { name: "14:00", main: 48, openfaas: 35 },
      { name: "16:00", main: 50, openfaas: 37 },
      { name: "18:00", main: 52, openfaas: 38 },
      { name: "20:00", main: 54, openfaas: 40 },
      { name: "22:00", main: 55, openfaas: 41 },
    ],
  },
  services: [
    { name: "frontend", status: "healthy", latency: 45, uptime: "99.99%", requests: 12500 },
    { name: "backend-api", status: "healthy", latency: 78, uptime: "99.98%", requests: 28700 },
    { name: "mysql", status: "healthy", latency: 12, uptime: "99.95%", requests: 45200 },
    { name: "redis", status: "healthy", latency: 5, uptime: "99.99%", requests: 87600 },
    { name: "celery", status: "healthy", latency: 32, uptime: "99.97%", requests: 15800 },
    { name: "openfaas-gateway", status: "healthy", latency: 65, uptime: "99.96%", requests: 8900 },
    { name: "function-scanner", status: "healthy", latency: 120, uptime: "99.92%", requests: 5400 },
  ],
  openfaas: {
    functions: [{ name: "scan-function", invocations: 5400, avgDuration: 1250, status: "ready" }],
    invocations: [
      { name: "00:00", value: 180 },
      { name: "02:00", value: 150 },
      { name: "04:00", value: 120 },
      { name: "06:00", value: 210 },
      { name: "08:00", value: 320 },
      { name: "10:00", value: 480 },
      { name: "12:00", value: 520 },
      { name: "14:00", value: 490 },
      { name: "16:00", value: 540 },
      { name: "18:00", value: 420 },
      { name: "20:00", value: 350 },
      { name: "22:00", value: 240 },
    ],
    duration: [
      { name: "00:00", value: 1150 },
      { name: "02:00", value: 1180 },
      { name: "04:00", value: 1120 },
      { name: "06:00", value: 1210 },
      { name: "08:00", value: 1280 },
      { name: "10:00", value: 1320 },
      { name: "12:00", value: 1350 },
      { name: "14:00", value: 1290 },
      { name: "16:00", value: 1310 },
      { name: "18:00", value: 1270 },
      { name: "20:00", value: 1230 },
      { name: "22:00", value: 1190 },
    ],
  },
}

// Function to check if user is admin (mock implementation)
const isUserAdmin = (user: any): boolean => {
  // In a real implementation, this would check user roles/permissions
  // For now, we'll check if the user email contains "admin" or specific admin emails
  if (!user || !user.email) return false

  const adminEmails = ["admin@example.com", "administrator@example.com", "andrei.mail8080@gmail.com"]
  const isAdminEmail = adminEmails.includes(user.email.toLowerCase())
  const hasAdminInEmail = user.email.toLowerCase().includes("admin")

  return isAdminEmail || hasAdminInEmail
}

// Access Denied Component
const AccessDenied = () => {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <ShieldX className="h-24 w-24 text-red-500 mx-auto" />
        <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          You don't have permission to access the AdminX dashboard. This area is restricted to administrators only.
        </p>
      </div>

      <div className="flex space-x-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <Button onClick={() => router.push("/dashboard")} className="flex items-center">
          Go to Dashboard
        </Button>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm">Need Admin Access?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you believe you should have administrative access, please contact your system administrator or IT support
            team to request the necessary permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminXPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("users")
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banDuration, setBanDuration] = useState("7")
  const [banReason, setBanReason] = useState("")
  const [loading, setLoading] = useState({
    users: true,
    stats: true,
    system: true,
  })
  const [stats, setStats] = useState<any>(null)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check admin access
  useEffect(() => {
    setIsAdmin(user ? isUserAdmin(user) : false)
  }, [user])

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch users data
        const usersData = await adminAPI.getUsers().catch(() => mockUsers)
        setUsers(usersData)
        setFilteredUsers(usersData)
        setLoading((prev) => ({ ...prev, users: false }))

        // Fetch aggregated stats
        const statsData = await adminAPI.getAggregatedStats().catch(() => mockAggregatedStats)
        setStats(statsData)
        setLoading((prev) => ({ ...prev, stats: false }))

        // Fetch system status
        const systemData = await adminAPI.getSystemOverview().catch(() => mockSystemStatus)
        setSystemStatus(systemData)
        setLoading((prev) => ({ ...prev, system: false }))
      } catch (error) {
        console.error("Error fetching admin data:", error)
        // Fallback to mock data
        setUsers(mockUsers)
        setFilteredUsers(mockUsers)
        setStats(mockAggregatedStats)
        setSystemStatus(mockSystemStatus)
        setLoading({ users: false, stats: false, system: false })
      }
    }

    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = users.filter(
        (user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  // Handle ban user
  const handleBanUser = async () => {
    if (!selectedUser) return

    try {
      await adminAPI.banUser(selectedUser.id, {
        duration: Number.parseInt(banDuration),
        reason: banReason,
      })

      // Update user in state
      const updatedUsers = users.map((user) => {
        if (user.id === selectedUser.id) {
          return {
            ...user,
            status: "banned",
            banReason,
            banExpiry: new Date(Date.now() + Number.parseInt(banDuration) * 24 * 60 * 60 * 1000).toISOString(),
          }
        }
        return user
      })

      setUsers(updatedUsers)
      setFilteredUsers(
        updatedUsers.filter(
          (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      )

      toast.success(`User ${selectedUser.name} has been banned`)
      setBanDialogOpen(false)
      setBanReason("")
      setBanDuration("7")
    } catch (error) {
      console.error("Error banning user:", error)
      toast.error("Failed to ban user. Please try again.")
    }
  }

  // Handle unban user
  const handleUnbanUser = async (userId: string) => {
    try {
      await adminAPI.unbanUser(userId)

      // Update user in state
      const updatedUsers = users.map((user) => {
        if (user.id === userId) {
          return {
            ...user,
            status: "active",
            banReason: undefined,
            banExpiry: undefined,
          }
        }
        return user
      })

      setUsers(updatedUsers)
      setFilteredUsers(
        updatedUsers.filter(
          (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      )

      toast.success("User has been unbanned")
    } catch (error) {
      console.error("Error unbanning user:", error)
      toast.error("Failed to unban user. Please try again.")
    }
  }

  // If still loading auth, show loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // If user is not admin, show access denied
  if (!isAdmin) {
    return <AccessDenied />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AdminX</h1>
        <p className="text-muted-foreground">Advanced administrative tools and system monitoring</p>
      </div>

      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center">
            <BarChart className="mr-2 h-4 w-4" />
            Aggregated Statistics
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center">
            <Server className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  User Management
                </div>
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardTitle>
              <CardDescription>View and manage user accounts, activity, and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.users ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scans</TableHead>
                      <TableHead>Targets</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-4">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatToBucharestTime(user.registeredDate)}</TableCell>
                          <TableCell>
                            {user.status === "active" ? (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Banned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{user.stats.scansRun}</TableCell>
                          <TableCell>{user.stats.targetsScanned}</TableCell>
                          <TableCell>{user.stats.findingsGenerated}</TableCell>
                          <TableCell>{user.stats.reportsCreated}</TableCell>
                          <TableCell>{formatToBucharestTime(user.lastActive)}</TableCell>
                          <TableCell>
                            {user.status === "active" ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user)
                                  setBanDialogOpen(true)
                                }}
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Ban
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => handleUnbanUser(user.id)}>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Unban
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Ban User Dialog */}
          <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Ban className="mr-2 h-5 w-5 text-destructive" />
                  Ban User
                </DialogTitle>
                <DialogDescription>
                  {selectedUser && (
                    <span>
                      You are about to ban <strong>{selectedUser.name}</strong> ({selectedUser.email}). This will
                      prevent them from accessing the platform.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="duration" className="text-sm font-medium">
                    Ban Duration (days)
                  </label>
                  <Select value={banDuration} onValueChange={setBanDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reason" className="text-sm font-medium">
                    Reason for Ban
                  </label>
                  <Input
                    id="reason"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Provide a reason for the ban"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleBanUser} disabled={!banReason.trim()}>
                  Ban User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Aggregated Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          {loading.stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.activeScanningUsers} active scanning users
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalScans}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Targets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTargets}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Findings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalFindings}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalReports}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <LineChartIcon className="mr-2 h-5 w-5" />
                      Scan Activity Trends
                    </CardTitle>
                    <CardDescription>Monthly scan volume over the past year</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={stats.scanTrends}
                      index="name"
                      categories={["value"]}
                      colors={["#2563eb"]}
                      valueFormatter={(value) => `${value} scans`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <PieChartIcon className="mr-2 h-5 w-5" />
                      Findings by Severity
                    </CardTitle>
                    <CardDescription>Distribution of findings across severity levels</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <PieChart
                      data={stats.findingsBySeverity}
                      index="name"
                      categories={["value"]}
                      colors={stats.findingsBySeverity.map((item: any) => item.color)}
                      valueFormatter={(value) => `${value} findings`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <PieChartIcon className="mr-2 h-5 w-5" />
                      Top Vulnerable Ports
                    </CardTitle>
                    <CardDescription>Most frequently identified vulnerable ports</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <PieChart
                      data={stats.findingsByPort}
                      index="name"
                      categories={["value"]}
                      colors={stats.findingsByPort.map((item: any) => item.color)}
                      valueFormatter={(value) => `${value} findings`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <PieChartIcon className="mr-2 h-5 w-5" />
                      Service Vulnerabilities
                    </CardTitle>
                    <CardDescription>Distribution of findings across service types</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <PieChart
                      data={stats.findingsByService}
                      index="name"
                      categories={["value"]}
                      colors={stats.findingsByService.map((item: any) => item.color)}
                      valueFormatter={(value) => `${value} findings`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <LineChartIcon className="mr-2 h-5 w-5" />
                      User Activity Levels
                    </CardTitle>
                    <CardDescription>Monthly active users over the past year</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={stats.userActivity}
                      index="name"
                      categories={["value"]}
                      colors={["#16a34a"]}
                      valueFormatter={(value) => `${value} users`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <PieChartIcon className="mr-2 h-5 w-5" />
                      Target Type Distribution
                    </CardTitle>
                    <CardDescription>Distribution of scanned targets by category</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <PieChart
                      data={stats.targetDistribution}
                      index="name"
                      categories={["value"]}
                      colors={stats.targetDistribution.map((item: any) => item.color)}
                      valueFormatter={(value) => `${value} targets`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Row 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <LineChartIcon className="mr-2 h-5 w-5" />
                      Report Generation Trends
                    </CardTitle>
                    <CardDescription>Monthly report generation over the past year</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={stats.reportGeneration}
                      index="name"
                      categories={["value"]}
                      colors={["#ca8a04"]}
                      valueFormatter={(value) => `${value} reports`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <LineChartIcon className="mr-2 h-5 w-5" />
                      Finding Discovery Rate
                    </CardTitle>
                    <CardDescription>Monthly finding discovery over the past year</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={stats.findingDiscoveryRate}
                      index="name"
                      categories={["value"]}
                      colors={["#dc2626"]}
                      valueFormatter={(value) => `${value} findings`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          {loading.system ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-80 w-full" />
              </div>
            </div>
          ) : (
            <>
              {/* Cluster Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemStatus.clusters.map((cluster: any) => (
                  <Card key={cluster.name}>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <Server className="mr-2 h-5 w-5" />
                        {cluster.name}
                        {cluster.status === "healthy" ? (
                          <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Issues
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {cluster.nodes} nodes, {cluster.pods} pods, {cluster.uptime} uptime
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Deployments</span>
                            <span className="font-medium">{cluster.deployments}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Services</span>
                            <span className="font-medium">{cluster.services}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Last Incident</span>
                            <span className="font-medium">{new Date(cluster.lastIncident).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <span className="font-medium capitalize">{cluster.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Uptime</span>
                            <span className="font-medium">{cluster.uptime}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Nodes</span>
                            <span className="font-medium">{cluster.nodes}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Resource Usage Charts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Cpu className="mr-2 h-5 w-5" />
                      CPU Usage
                    </CardTitle>
                    <CardDescription>24-hour CPU utilization percentage</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={systemStatus.resourceUsage.cpu}
                      index="name"
                      categories={["main", "openfaas"]}
                      colors={["#2563eb", "#16a34a"]}
                      valueFormatter={(value) => `${value}%`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Memory className="mr-2 h-5 w-5" />
                      Memory Usage
                    </CardTitle>
                    <CardDescription>24-hour memory utilization percentage</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={systemStatus.resourceUsage.memory}
                      index="name"
                      categories={["main", "openfaas"]}
                      colors={["#2563eb", "#16a34a"]}
                      valueFormatter={(value) => `${value}%`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <HardDrive className="mr-2 h-5 w-5" />
                      Disk Usage
                    </CardTitle>
                    <CardDescription>24-hour disk utilization percentage</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <LineChart
                      data={systemStatus.resourceUsage.disk}
                      index="name"
                      categories={["main", "openfaas"]}
                      colors={["#2563eb", "#16a34a"]}
                      valueFormatter={(value) => `${value}%`}
                      className="h-72"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Deployments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Layers className="mr-2 h-5 w-5" />
                    Deployments
                  </CardTitle>
                  <CardDescription>Status of all Kubernetes deployments</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Cluster</TableHead>
                          <TableHead>Replicas</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemStatus.deployments.map((deployment: any) => (
                          <TableRow key={`${deployment.cluster}-${deployment.name}`}>
                            <TableCell className="font-medium">{deployment.name}</TableCell>
                            <TableCell>{deployment.cluster}</TableCell>
                            <TableCell>{deployment.replicas}</TableCell>
                            <TableCell>{deployment.available}</TableCell>
                            <TableCell>
                              {deployment.status === "healthy" ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Healthy
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Issues
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Nodes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Server className="mr-2 h-5 w-5" />
                    Nodes
                  </CardTitle>
                  <CardDescription>Status of all Kubernetes nodes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Cluster</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>CPU</TableHead>
                          <TableHead>Memory</TableHead>
                          <TableHead>Disk</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemStatus.nodes.map((node: any) => (
                          <TableRow key={node.name}>
                            <TableCell className="font-medium">{node.name}</TableCell>
                            <TableCell>{node.cluster}</TableCell>
                            <TableCell className="capitalize">{node.role}</TableCell>
                            <TableCell>{node.cpu}%</TableCell>
                            <TableCell>{node.memory}%</TableCell>
                            <TableCell>{node.disk}%</TableCell>
                            <TableCell>
                              {node.status === "healthy" ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Healthy
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Issues
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Services */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Network className="mr-2 h-5 w-5" />
                    Services
                  </CardTitle>
                  <CardDescription>Status of all application services</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Latency</TableHead>
                          <TableHead>Uptime</TableHead>
                          <TableHead>Requests (24h)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemStatus.services.map((service: any) => (
                          <TableRow key={service.name}>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell>
                              {service.status === "healthy" ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Healthy
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Issues
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{service.latency} ms</TableCell>
                            <TableCell>{service.uptime}</TableCell>
                            <TableCell>{service.requests.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* OpenFaaS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Zap className="mr-2 h-5 w-5" />
                    OpenFaaS Functions
                  </CardTitle>
                  <CardDescription>Status and metrics for serverless functions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Function</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Invocations (24h)</TableHead>
                          <TableHead>Avg. Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemStatus.openfaas.functions.map((fn: any) => (
                          <TableRow key={fn.name}>
                            <TableCell className="font-medium">{fn.name}</TableCell>
                            <TableCell>
                              {fn.status === "ready" ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Ready
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Issues
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{fn.invocations.toLocaleString()}</TableCell>
                            <TableCell>{fn.avgDuration} ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Function Invocations (24h)</h3>
                        <LineChart
                          data={systemStatus.openfaas.invocations}
                          index="name"
                          categories={["value"]}
                          colors={["#9333ea"]}
                          valueFormatter={(value) => `${value} calls`}
                          className="h-60"
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2">Function Duration (24h)</h3>
                        <LineChart
                          data={systemStatus.openfaas.duration}
                          index="name"
                          categories={["value"]}
                          colors={["#ca8a04"]}
                          valueFormatter={(value) => `${value} ms`}
                          className="h-60"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
