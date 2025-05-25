"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, AlertTriangle, Shield, Save, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { findingsAPI } from "@/lib/api"

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

const getSeverityIcon = (severity: string) => {
  switch (severity?.toLowerCase()) {
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
  const [finding, setFinding] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
        const data = await findingsAPI.getFinding(findingId)
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

    if (findingId) {
      fetchFinding()
    }
  }, [findingId])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updatedFinding = await findingsAPI.updateFinding(findingId, editData)
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
              {getSeverityIcon(finding.severity)}
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
            <Button onClick={() => setIsEditing(true)}>Edit Finding</Button>
          )}
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
                <h3 className="text-sm font-medium text-muted-foreground">Finding Name</h3>
                <p className="mt-1 text-lg">{finding.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Severity</h3>
                <div className="mt-1">
                  {isEditing ? (
                    <Select
                      value={editData.severity}
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
                    <Badge className={getSeverityColor(finding.severity)}>
                      {finding.severity?.toUpperCase() || "UNKNOWN"}
                    </Badge>
                  )}
                </div>
              </div>
              {finding.port && (
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
              )}
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
            <CardTitle>Target Information</CardTitle>
            <CardDescription>Information about the affected target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Target ID</h3>
                <p className="mt-1">{finding.target_id}</p>
              </div>
              {finding.os && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Operating System</h3>
                  <p className="mt-1">{finding.os}</p>
                </div>
              )}
              {finding.port_state && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Port State</h3>
                  <p className="mt-1 capitalize">{finding.port_state.toLowerCase()}</p>
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
    </div>
  )
}
