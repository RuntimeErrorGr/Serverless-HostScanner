"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeleteFindingDialog } from "@/components/delete-finding-dialog"
import { OSIcon } from "@/components/os-icon"
import { TracerouteVisualization } from "@/components/traceroute-visualization"
import { ArrowLeft, AlertTriangle, Shield, Save, Loader2, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { findingsAPI } from "@/lib/api"
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

const getSeverityIcon = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-600" />
    case "high":
      return <AlertTriangle className="h-5 w-5 text-orange-600" />
    case "medium":
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    case "low":
      return <Shield className="h-5 w-5 text-blue-600" />
    case "info":
    default:
      return <Shield className="h-5 w-5 text-gray-600" />
  }
}

const isScriptFinding = (name: string) => {
  return name?.toLowerCase().includes("script")
}

const isOSFinding = (name: string) => {
  return name?.toLowerCase().includes("os")
}

const isTracerouteFinding = (name: string) => {
  return name?.toLowerCase().includes("traceroute")
}

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
    <code>{children}</code>
  </pre>
)

const OSDetails = ({ data }: { data: any }) => (
  <div className="space-y-4">
    <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
      <OSIcon osName={data.name} className="h-8 w-8" />
      <div>
        <h4 className="font-semibold text-lg">{data.name}</h4>
        <p className="text-sm text-muted-foreground">Detection Accuracy: {data.accuracy}%</p>
      </div>
    </div>

    {data.classes && data.classes.length > 0 && (
      <div>
        <h5 className="font-medium mb-3">OS Classification Details</h5>
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Vendor</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">OS Family</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Generation</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((osClass: any, index: number) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="p-3 capitalize">{osClass.type || "-"}</td>
                  <td className="p-3">{osClass.vendor || "-"}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <OSIcon osName={osClass.osfamily} className="h-4 w-4" />
                      <span>{osClass.osfamily || "-"}</span>
                    </div>
                  </td>
                  <td className="p-3">{osClass.osgen || "-"}</td>
                  <td className="p-3">{osClass.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)

export default function FindingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const findingUuid = params.id as string
  const [finding, setFinding] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editData, setEditData] = useState({
    description: "",
    recommendation: "",
    severity: "",
  })

  // Fetch finding data
  useEffect(() => {
    async function fetchFinding() {
      try {
        setIsLoading(true)
        const data = await findingsAPI.getFinding(findingUuid)

        setFinding(data)
        setEditData({
          description: data.description || "",
          recommendation: data.recommendation || "",
          severity: data.severity || "",
        })
      } catch (error) {
        console.error("Error fetching finding:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load finding. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (findingUuid) {
      fetchFinding()
    }
  }, [findingUuid])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updatedFinding = await findingsAPI.updateFinding(findingUuid, editData)
      setFinding(updatedFinding)
      setIsEditing(false)
      toast({
        variant: "success",
        title: "Finding updated",
        description: "The finding has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating finding:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update finding. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData({
      description: finding.description || "",
      recommendation: finding.recommendation || "",
      severity: finding.severity || "",
    })
    setIsEditing(false)
  }

  const handleDeleteFinding = async () => {
    try {
      await findingsAPI.deleteFinding(findingUuid)
      toast({
        variant: "success",
        title: "Finding deleted",
        description: "The finding has been deleted successfully.",
      })
      router.push("/findings")
    } catch (error) {
      console.error("Error deleting finding:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete finding. Please try again.",
      })
    }
  }

  const renderEvidence = () => {
    if (!finding.evidence) return <p className="text-muted-foreground">No evidence available.</p>

    const isScript = isScriptFinding(finding.name)
    const isOS = isOSFinding(finding.name)
    const isTraceroute = isTracerouteFinding(finding.name)

    try {
      if (isTraceroute) {
        // Parse traceroute data
        const tracerouteData = finding.evidence
        if (Array.isArray(tracerouteData)) {
          return <TracerouteVisualization data={tracerouteData} />
        }
      } else if (isOS) {
        // For OS findings, we display the OS details directly without "Technical Evidence" section
        const osData = finding.evidence
        return <OSDetails data={osData} />
      } else if (isScript) {
        // Display as code block for scripts
        return <CodeBlock>{finding.evidence}</CodeBlock>
      }
    } catch (error) {
      console.error("Error parsing evidence data:", error)
      // Fallback to raw text display
    }

    // Default display for other types or parsing errors
    return <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-line">{finding.evidence}</p>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading finding...</p>
        </div>
      </div>
    )
  }

  if (!finding) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Finding not found</h3>
          <p className="text-muted-foreground mt-2">
            The finding you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    )
  }

  const isOS = isOSFinding(finding.name)
  const isTraceroute = isTracerouteFinding(finding.name)

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              {getSeverityIcon(finding.severity || "info")}
              <span className="ml-2">Finding Details</span>
            </h1>
            <p className="text-muted-foreground">Detailed information about the security finding</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)}>Edit Finding</Button>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Finding Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Finding Name</h3>
                <p className="mt-1 text-lg">{finding.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Severity</h3>
                <div className="mt-1">
                  {isEditing ? (
                    <Select
                      value={editData.severity?.toUpperCase()}
                      onValueChange={(value) => setEditData({ ...editData, severity: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INFO">Info</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getSeverityColor(finding.severity || "info")}>
                      <span className={`font-bold ${getSeverityTextColor(finding.severity || "info")}`}>
                        {finding.severity?.toUpperCase() || "UNKNOWN"}
                      </span>
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {finding.port && (
                  <>
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
                      <p className="mt-1">{finding.service?.toUpperCase()}</p>
                    </div>
                  </>
                )}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Date Found</h3>
                  <div className="mt-1">{formatToBucharestTime(finding.created_at)}</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
                  <div className="mt-1">{formatToBucharestTime(finding.updated_at)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isOS ? "Operating System Detection" : isTraceroute ? "Network Traceroute" : "Finding Evidence"}
            </CardTitle>
            <CardDescription>
              {isOS
                ? "Detected operating system information and classification details"
                : isTraceroute
                  ? "Network path analysis showing route to target"
                  : "Technical details that support this security finding"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!isOS && finding.os && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Operating System</h3>
                  <div className="mt-1 flex items-center space-x-2">
                    <OSIcon osName={finding.os} className="h-5 w-5" />
                    <span>{finding.os}</span>
                  </div>
                </div>
              )}
              {!isOS && finding.port_state && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Port State</h3>
                  <p className="mt-1 capitalize">{finding.port_state.toLowerCase()}</p>
                </div>
              )}
              {finding.evidence && (
                <div>
                  {!isOS && <h3 className="text-sm font-medium text-muted-foreground mb-2">Technical Evidence</h3>}
                  <div>{renderEvidence()}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Enter finding description..."
              className="min-h-[100px]"
            />
          ) : (
            <p className="whitespace-pre-line">{finding.description || "No description available."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editData.recommendation}
              onChange={(e) => setEditData({ ...editData, recommendation: e.target.value })}
              placeholder="Enter recommendations..."
              className="min-h-[100px]"
            />
          ) : (
            <p className="whitespace-pre-line">{finding.recommendation || "No recommendations available."}</p>
          )}
        </CardContent>
      </Card>

      <DeleteFindingDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteFinding}
        findingName={finding.name}
      />
    </div>
  )
}
