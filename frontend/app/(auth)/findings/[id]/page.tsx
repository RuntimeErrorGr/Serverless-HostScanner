"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, AlertTriangle, Shield } from "lucide-react"

// Mock data for a finding
const mockFindingData = {
  id: "finding-1",
  target_id: "target-1",
  target_name: "example.com",
  port: 443,
  port_state: "open",
  protocol: "tcp",
  service: "https",
  script_results: "SSL certificate expires in 30 days",
  description:
    "The SSL certificate for this service is approaching its expiration date. Expired certificates can lead to security warnings for users and potentially expose the service to man-in-the-middle attacks if not renewed.",
  recommendations:
    "Renew the SSL certificate before it expires. Consider implementing automatic certificate renewal using services like Let's Encrypt and certbot to prevent future expirations.",
  created_at: new Date(Date.now() - 5000000000).toISOString(),
  updated_at: new Date(Date.now() - 1000000000).toISOString(),
  severity: "medium",
  related_targets: [
    { id: "target-1", name: "example.com" },
    { id: "target-3", name: "api.example.com" },
    { id: "target-5", name: "admin.example.com" },
  ],
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-500 hover:bg-red-600"
    case "high":
      return "bg-orange-500 hover:bg-orange-600"
    case "medium":
      return "bg-yellow-500 hover:bg-yellow-600"
    case "low":
      return "bg-blue-500 hover:bg-blue-600"
    default:
      return "bg-gray-500 hover:bg-gray-600"
  }
}

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "critical":
    case "high":
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    case "medium":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    case "low":
    case "info":
      return <Shield className="h-5 w-5 text-blue-500" />
    default:
      return <Shield className="h-5 w-5 text-gray-500" />
  }
}

export default function FindingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const findingId = params.id as string
  const [finding, setFinding] = useState(mockFindingData)

  // Fetch finding data
  useEffect(() => {
    // In a real app, you would fetch the finding data from the API
    console.log(`Fetching finding data for ${findingId}...`)
  }, [findingId])

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => router.back()} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            {getSeverityIcon(finding.severity)}
            <span className="ml-2">Finding Details</span>
          </h1>
          <p className="text-muted-foreground">Detailed information about the security finding</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Finding Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Finding</h3>
                <p className="mt-1 text-lg">{finding.script_results}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Severity</h3>
                <div className="mt-1">
                  <Badge className={getSeverityColor(finding.severity)}>{finding.severity.toUpperCase()}</Badge>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Target</h3>
                <p className="mt-1">{finding.target_name}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Port</h3>
                  <p className="mt-1">{finding.port}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Protocol</h3>
                  <p className="mt-1 capitalize">{finding.protocol}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Service</h3>
                  <p className="mt-1">{finding.service}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Date Found</h3>
                  <p className="mt-1">{new Date(finding.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
                  <p className="mt-1">{new Date(finding.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related Targets</CardTitle>
            <CardDescription>Other targets with the same finding</CardDescription>
          </CardHeader>
          <CardContent>
            {finding.related_targets.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finding.related_targets.map((target) => (
                    <TableRow
                      key={target.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/targets/${target.id}`)}
                    >
                      <TableCell>{target.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <p>No related targets found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line">{finding.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line">{finding.recommendations}</p>
        </CardContent>
      </Card>
    </div>
  )
}
