"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { targetsAPI, scansAPI, findingsAPI } from "@/lib/api"

export default function TargetDetailPage() {
  const params = useParams()
  const targetId = params.id as string
  const [target, setTarget] = useState<any>(null)
  const [scans, setScans] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch target data and related information
  useEffect(() => {
    async function fetchTargetData() {
      try {
        setIsLoading(true)

        // Fetch target details
        const targetData = await targetsAPI.getTarget(targetId)
        setTarget(targetData)

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

        // Fetch all findings and filter by target
        const allFindings = await findingsAPI.getFindings()
        const targetFindings = allFindings.filter((finding: any) => finding.target_id === Number.parseInt(targetId))
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

    if (targetId) {
      fetchTargetData()
    }
  }, [targetId])

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{target.name}</h1>
        <p className="text-muted-foreground">Target details and scan history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="mt-1">{target.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date Added</p>
              <p className="mt-1">{new Date(target.created_at).toLocaleString()}</p>
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
                      <TableRow key={scan.uuid} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{scan.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div
                              className={`h-2 w-2 rounded-full mr-2 ${
                                scan.status === "COMPLETED"
                                  ? "bg-green-500"
                                  : scan.status === "RUNNING"
                                    ? "bg-blue-500"
                                    : scan.status === "PENDING"
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                              }`}
                            />
                            <span className="capitalize">{scan.status.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{scan.type?.toLowerCase()}</TableCell>
                        <TableCell>{new Date(scan.created_at).toLocaleString()}</TableCell>
                        <TableCell>{scan.finished_at ? new Date(scan.finished_at).toLocaleString() : "-"}</TableCell>
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
                      <TableRow key={finding.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{finding.name}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              finding.severity === "CRITICAL"
                                ? "bg-red-100 text-red-800"
                                : finding.severity === "HIGH"
                                  ? "bg-orange-100 text-orange-800"
                                  : finding.severity === "MEDIUM"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : finding.severity === "LOW"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </TableCell>
                        <TableCell>{finding.port ? `${finding.port}/${finding.protocol}` : "-"}</TableCell>
                        <TableCell>{finding.service || "-"}</TableCell>
                        <TableCell>{new Date(finding.created_at).toLocaleString()}</TableCell>
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
    </div>
  )
}
