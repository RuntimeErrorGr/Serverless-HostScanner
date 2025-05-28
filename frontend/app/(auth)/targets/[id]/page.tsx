"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteTargetDialog } from "@/components/delete-target-dialog"
import { Loader2, ArrowLeft, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { targetsAPI, scansAPI, findingsAPI } from "@/lib/api"
import { formatToBucharestTime } from "@/lib/timezone"

const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "bg-red-500 hover:bg-red-600"
    case "high":
      return "bg-orange-500 hover:bg-orange-600"
    case "medium":
      return "bg-yellow-500 hover:bg-yellow-600"
    case "low":
      return "bg-blue-500 hover:bg-blue-600"
    case "info":
    default:
      return "bg-gray-500 hover:bg-gray-600"
  }
}

const getSeverityTextColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "text-white"
    case "high":
      return "text-white"
    case "medium":
      return "text-white"
    case "low":
      return "text-white"
    case "info":
    default:
      return "text-white"
  }
}

export default function TargetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const targetUuid = params.id as string
  const [target, setTarget] = useState<any>(null)
  const [scans, setScans] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [flagInfo, setFlagInfo] = useState<{ country: string, flag_url: string } | null>(null)


  // Fetch target data and related information
  useEffect(() => {
    async function fetchTargetData() {
      try {
        setIsLoading(true)

        // Fetch target details
        const targetData = await targetsAPI.getTarget(targetUuid)
        setTarget(targetData)
        // Fetch flag info
        const flagInfo = await targetsAPI.getTargetFlag(targetUuid)
        setFlagInfo(flagInfo)

        // Fetch all scans and filter by target
        const allScans = await scansAPI.getScans()
        // Filter scans that include this target
        const targetScans = allScans.filter((scan: any) => {
          // Parse targets if it's a JSON string
          let targets = scan.targets
          if (typeof targets === "string") {
            try {
              targets = JSON.parse(targets)
            } catch {
              targets = [targets]
            }
          }
          return Array.isArray(targets) ? targets.includes(targetData.name) : targets === targetData.name
        })
        setScans(targetScans)

        // Fetch findings for this target
        const targetFindings = await findingsAPI.getFindingsByTarget(targetUuid)
        setFindings(targetFindings)
      } catch (error) {
        console.error("Error fetching target data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load target data. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (targetUuid) {
      fetchTargetData()
    }
  }, [targetUuid])

  const handleScanClick = (scanUuid: string, status: string) => {
    if (status === "completed" || status === "failed") {
      router.push(`/scans/${scanUuid}`)
    } else {
      router.push(`/scans/${scanUuid}/running`)
    }
  }

  const handleFindingClick = (findingUuid: string) => {
    router.push(`/findings/${findingUuid}`)
  }

  const handleDeleteTarget = async () => {
    try {
      await targetsAPI.deleteTarget(targetUuid)
      toast({
        variant: "success",
        title: "Target deleted",
        description: "The target has been deleted successfully.",
      })
      router.push("/targets")
    } catch (error) {
      console.error("Error deleting target:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete target. Please try again.",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading target data...</p>
        </div>
      </div>
    )
  }

  if (!target) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium">Target not found</h3>
          <p className="text-muted-foreground mt-2">The target you're looking for doesn't exist or has been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${flagInfo ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="mt-1">{target.name}</p>
            </div>
            {flagInfo && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">DNS response</p>
                <div className="mt-1 flex items-center space-x-2">
                  <img src={flagInfo.flag_url} alt={flagInfo.country} className="w-6 h-4 rounded-sm" />
                  <span>{flagInfo.country}</span>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date Added</p>
              <div className="mt-1">{formatToBucharestTime(target.created_at)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
              <p className="mt-1">{scans.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="scans">
        <TabsList>
          <TabsTrigger value="scans">Scan History ({scans.length})</TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="scans">
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
            </CardHeader>
            <CardContent>
              {scans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scan Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((scan) => (
                      <TableRow
                        key={scan.uuid}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleScanClick(scan.uuid, scan.status)}
                      >
                        <TableCell className="font-medium">{scan.name}</TableCell>
                        <TableCell>
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
                            <span className="capitalize">{scan.status.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{scan.type?.toLowerCase()}</TableCell>
                        <TableCell>{formatToBucharestTime(scan.started_at)}</TableCell>
                        <TableCell>
                          {scan.finished_at ? formatToBucharestTime(scan.finished_at) : <span>-</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No scans found for this target</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="findings">
          <Card>
            <CardHeader>
              <CardTitle>Security Findings</CardTitle>
            </CardHeader>
            <CardContent>
              {findings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Port</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Date Found</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((finding) => (
                      <TableRow
                        key={finding.uuid}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleFindingClick(finding.uuid)}
                      >
                        <TableCell className="font-medium">{finding.name}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(finding.severity)}>
                            <span className={`font-bold ${getSeverityTextColor(finding.severity)}`}>
                              {finding.severity?.toUpperCase() || "UNKNOWN"}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>{finding.port ? `${finding.port}/${finding.protocol}` : "-"}</TableCell>
                        <TableCell>{finding.service?.toUpperCase() || "-"}</TableCell>
                        <TableCell>{formatToBucharestTime(finding.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No findings found for this target</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteTargetDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteTarget}
        target={target}
      />
    </div>
  )
}
