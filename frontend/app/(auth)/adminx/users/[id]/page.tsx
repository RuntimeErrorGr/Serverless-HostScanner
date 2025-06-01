"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table/data-table"
import { formatToBucharestTime } from "@/lib/timezone"
import { adminAPI } from "@/lib/api"
import { useAdminCheck } from "@/hooks/use-admin-check"
import {
  ArrowLeft,
  User,
  Calendar,
  Mail,
  Shield,
  CheckCircle,
  Ban,
  Activity,
  Target,
  FileText,
  AlertTriangle,
  ShieldX,
} from "lucide-react"
import { toast } from "sonner"

// Access Denied Component
const AccessDenied = () => {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <ShieldX className="h-24 w-24 text-red-500 mx-auto" />
        <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          You don't have permission to access user details. This area is restricted to administrators only.
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
    </div>
  )
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAdmin, isLoading: adminLoading } = useAdminCheck()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const userId = params.id as string

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!isAdmin) return

      try {
        setLoading(true)
        const userData = await adminAPI.getUserDetails(userId)
        setUser(userData)
      } catch (error) {
        console.error("Error fetching user details:", error)
        toast.error("Failed to fetch user details")
      } finally {
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchUserDetails()
    }
  }, [userId, isAdmin])

  // If still loading admin check, show loading
  if (adminLoading) {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="text-center space-y-4">
          <User className="h-24 w-24 text-muted-foreground mx-auto" />
          <h1 className="text-3xl font-bold">User Not Found</h1>
          <p className="text-lg text-muted-foreground max-w-md">
            The user you're looking for doesn't exist or may have been removed.
          </p>
        </div>
        <Button onClick={() => router.push("/adminx")} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to AdminX
        </Button>
      </div>
    )
  }

  const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username

  // Define columns for each table
  const scanColumns = [
    {
      key: "name",
      title: "Scan Name",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
      render: (scan: any) => (
        <div className="flex items-center">
          <div
            className={`h-2 w-2 rounded-full mr-2 ${
              scan.status.toLowerCase() === "completed"
                ? "bg-green-500"
                : scan.status.toLowerCase() === "running"
                  ? "bg-blue-500"
                  : scan.status.toLowerCase() === "pending"
                    ? "bg-yellow-500"
                    : "bg-red-500"
            }`}
          />
          <span className="capitalize">
            {scan.status.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      key: "created_at",
      title: "Created",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (scan: any) => formatToBucharestTime(scan.created_at),
    },
  ]

  const targetColumns = [
    {
      key: "name",
      title: "Target Name",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "created_at",
      title: "Created",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (target: any) => formatToBucharestTime(target.created_at),
    },
  ]

  const findingColumns = [
    {
      key: "name",
      title: "Finding Name",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "severity",
      title: "Severity",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
      render: (finding: any) => {
        const severityColors = {
          critical: "bg-red-500 hover:bg-red-600 text-white",
          high: "bg-orange-500 hover:bg-orange-600 text-white",
          medium: "bg-yellow-500 hover:bg-yellow-600 text-white",
          low: "bg-blue-500 hover:bg-blue-600 text-white",
          info: "bg-gray-500 hover:bg-gray-600 text-white",
        }
        return (
          <Badge
            className={severityColors[finding.severity as keyof typeof severityColors] || "bg-gray-500 hover:bg-gray-600 text-white"}
          >
            {finding.severity.toUpperCase()}
          </Badge>
        )
      },
    },
    {
      key: "created_at",
      title: "Created",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (finding: any) => formatToBucharestTime(finding.created_at),
    },
  ]

  const reportColumns = [
    {
      key: "name",
      title: "Report Name",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      filterType: "text" as const,
      render: (row: any) => (
        <div className="flex items-center">
          <div
            className={`h-2 w-2 rounded-full mr-2 ${
              row.status.toLowerCase() === "generated"
                ? "bg-green-500"
                : row.status.toLowerCase() === "pending"
                  ? "bg-blue-500"
                  : row.status.toLowerCase() === "failed"
                    ? "bg-yellow-500"
                    : "bg-red-500"
            }`}
          />
          <span className="capitalize">
            {row.status.toLowerCase() === "generated" ? "Ready" : row.status.toLowerCase() === "pending" ? "Pending" : row.status.toLowerCase() === "failed" ? "Failed" : "Generating"}
          </span>
        </div>
      ),
    },
    {
      key: "created_at",
      title: "Created",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (report: any) => formatToBucharestTime(report.created_at),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => router.push("/adminx")} className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to AdminX
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{userName}</h1>
            <p className="text-muted-foreground">User details and activity overview</p>
          </div>
        </div>
      </div>

      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <p className="text-sm">{user.email}</p>
              {user.email_verified && (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Username</span>
              </div>
              <p className="text-sm">{user.username}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Status</span>
              </div>
              {user.enabled ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                  <Ban className="mr-1 h-3 w-3" />
                  Disabled
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <p className="text-sm">{formatToBucharestTime(user.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Activity className="mr-2 h-4 w-4" />
              Total Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.total_scans}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Target className="mr-2 h-4 w-4" />
              Total Targets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.total_targets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Total Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.total_findings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.total_reports}</div>
          </CardContent>
        </Card>
      </div>

      {/* Scans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            Scans ({user.scans?.length || 0})
          </CardTitle>
          <CardDescription>All scans performed by this user</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={user.scans || []}
            columns={scanColumns}
            emptyState={
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No scans found for this user.</p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5" />
            Targets ({user.targets?.length || 0})
          </CardTitle>
          <CardDescription>All targets used by this user</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={user.targets || []}
            columns={targetColumns}
            emptyState={
              <div className="text-center py-8">
                <Target className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No targets found for this user.</p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Findings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Findings ({user.findings?.length || 0})
          </CardTitle>
          <CardDescription>All findings discovered by this user's scans</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={user.findings || []}
            columns={findingColumns}
            emptyState={
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No findings found for this user.</p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Reports ({user.reports?.length || 0})
          </CardTitle>
          <CardDescription>All reports generated by this user</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={user.reports || []}
            columns={reportColumns}
            emptyState={
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No reports found for this user.</p>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
