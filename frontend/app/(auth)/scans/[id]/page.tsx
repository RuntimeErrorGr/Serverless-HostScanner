"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GenerateReportDialog } from "@/components/generate-report-dialog"
import { DeleteScanDialog } from "@/components/delete-scan-dialog"
import { OSIcon } from "@/components/os-icon"
import { FileText, Loader2, ArrowLeft, Trash2, Target } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { scansAPI } from "@/lib/api"
import { formatToBucharestTime, formatDuration, formatToBucharestTimeSingleLine } from "@/lib/timezone"
import { ParameterSection } from "@/components/parameter-section"
import { TracerouteSection } from "@/components/traceroute-section"
import { ScriptDetailsDialog } from "@/components/script-details-dialog"
import { PortResultsTable } from "@/components/port-results-table"

// Interface for scan data from the API
interface ScanData {
  scan_uuid: string
  name: string
  status: string
  type: string
  parameters?: Record<string, any>
  output?: string
  result?: ScanResult[]
  targets: {name: string, uuid: string}[]
  created_at: string
  started_at?: string
  finished_at?: string
}

interface ScanResult {
  ip_address: string
  hostname: string
  target_uuid: string
  status: string
  last_seen: string
  reason: string
  reason_ttl: string
  os_info: {
    name?: string
    accuracy?: string
    classes?: Array<{
      type: string
      vendor: string
      osfamily: string
      osgen: string
      accuracy: string
    }>
  }
  ports: Array<{
    port: number | null
    protocol: string
    state: string
    reason: string
    reason_ttl: string
    service: {
      name?: string
      product?: string
      version?: string
      method?: string
      conf?: string
    }
    scripts: Record<string, string>
    count?: number
  }>
  traceroute: Array<{
    ttl: string
    ipaddr: string
    rtt: string
    host: string
  }>
  ssl_info: Record<string, any>
  http_headers: Record<string, any>
}

interface TargetResult {
  target: string
  hostname: string
  target_uuid: string
  os: string
  traceroute: Array<{
    ttl: string
    ipaddr: string
    rtt: string
    host: string
  }>
  ports: {
    port: number
    protocol: string
    service: string
    state: string
    product?: string
    version?: string
    scripts?: Record<string, string>
  }[]
}

// Default empty state
const initialScanData: ScanData = {
  scan_uuid: "",
  name: "",
  status: "",
  type: "",
  targets: [],
  created_at: "",
}

export default function FinishedScanPage() {
  const params = useParams()
  const router = useRouter()
  const scanId = params.id as string
  const [scan, setScan] = useState<ScanData>(initialScanData)
  const [targetResults, setTargetResults] = useState<TargetResult[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPort, setSelectedPort] = useState<any>(null)
  const [isScriptDialogOpen, setIsScriptDialogOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<string>("")

  // Function to get default/deep scan parameters
  const getDefaultScanParameters = (scanType: string) => {
    if (scanType === "default") {
      return {
        echo_request: true,
        tcp_syn_scan: true,
        tcp_ports: "top-100",
        timing_flag: 5,
      }
    } else if (scanType === "deep") {
      return {
        echo_request: true,
        timestamp_request: true,
        address_mask_request: true,
        os_detection: true,
        service_version: true,
        traceroute: true,
        ssl_scan: true,
        http_headers: true,
        tcp_syn_scan: true,
        timing_flag: 3,
        tcp_ports: "top-5000",
        udp_ports: "top-100",
      }
    }
    return {}
  }

  // Fetch scan data
  useEffect(() => {
    async function fetchScanData() {
      if (!scanId) return

      try {
        setIsLoading(true)

        // Fetch scan details using the API
        const scanData = await scansAPI.getScan(scanId)
        setScan(scanData)

        // Process scan results into target results
        if (scanData.result && scanData.result.length > 0) {
          const results: TargetResult[] = scanData.result.map((host: ScanResult) => {
            const targetName = host.hostname || host.ip_address
            const osName =
              host.os_info?.name ||
              (host.os_info?.classes && host.os_info.classes.length > 0
                ? `${host.os_info.classes[0].vendor} ${host.os_info.classes[0].osfamily} ${host.os_info.classes[0].osgen}`.trim()
                : "Unknown")

            // Filter out synthetic extraports entries and extract real ports
            const realPorts = host.ports
              .filter((port) => port.port !== null)
              .map((port) => ({
                port: port.port!,
                protocol: port.protocol,
                service: port.service?.name || "unknown",
                state: port.state,
                product: port.service?.product,
                version: port.service?.version,
                scripts: port.scripts || {},
              }))
              // Sort ports: open, open|filtered, closed, other states
              .sort((a, b) => {
                const getPortPriority = (state: string) => {
                  switch (state.toLowerCase()) {
                    case "open":
                      return 1
                    case "open|filtered":
                      return 2
                    case "closed":
                      return 3
                    default:
                      return 4
                  }
                }

                const priorityA = getPortPriority(a.state)
                const priorityB = getPortPriority(b.state)

                if (priorityA !== priorityB) {
                  return priorityA - priorityB
                }

                return a.port - b.port // Secondary sort by port number
              })

            return {
              target: targetName,
              hostname: host.hostname,
              os: osName,
              traceroute: host.traceroute || [],
              ports: realPorts,
            }
          })

          results.forEach((result) => {
            result.target_uuid = scanData.targets.find((target: { name: string; uuid: string }) => target.name === result.target)?.uuid || ""
          })

          setTargetResults(results)
        }
      } catch (err) {
        console.error("Error fetching scan data:", err)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load scan data. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchScanData()
  }, [scanId])

  const handleGenerateReport = (format: string) => {
    // API call would go here
    toast({
      variant: "success",
      title: "Report generated",
      description: `${format.toUpperCase()} report has been generated.`,
    })
    setIsReportDialogOpen(false)
  }

  const handleDeleteScan = async () => {
    try {
      await scansAPI.deleteScan(scanId)
      toast({
        variant: "success",
        title: "Scan deleted",
        description: "The scan has been deleted successfully.",
      })
      router.push("/scans")
    } catch (error) {
      console.error("Error deleting scan:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete scan. Please try again.",
      })
    }
  }

  const handlePortClick = (port: any, target: string) => {
    setSelectedPort(port)
    setSelectedTarget(target)
    setIsScriptDialogOpen(true)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading scan data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.push("/scans")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{scan.name}</h1>
            <p className="text-muted-foreground">
              Scan report generated on {formatToBucharestTimeSingleLine(scan.finished_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsReportDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="mt-1 flex items-center">
                <Badge variant="success" className="mr-2">
                  {scan.status === "completed" ? "Completed" : scan.status === "failed" ? "Failed" : scan.status}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Scan Type</p>
              <p className="mt-1">
                <Badge variant="outline">{scan.type?.charAt(0).toUpperCase() + scan.type?.slice(1) || "Unknown"}</Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Time</p>
              <div className="mt-1">{formatToBucharestTime(scan.started_at)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Time</p>
              <div className="mt-1">{formatToBucharestTime(scan.finished_at)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="mt-1">
                {scan.started_at && scan.finished_at ? formatDuration(scan.started_at, scan.finished_at) : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="nmap">Console</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="parameters">
          <ParameterSection
            parameters={scan.type === "custom" ? scan.parameters || {} : getDefaultScanParameters(scan.type || "")}
            targets={scan.targets.map((target) => target.name)}
          />
        </TabsContent>
        <TabsContent value="results">
          <div className="space-y-8">
            {targetResults.length > 0 ? (
              targetResults.map((result, index) => (
                <Card key={index} className="border-2">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">
                          <button
                            onClick={() => router.push(`/targets/${encodeURIComponent(result.target_uuid)}`)}
                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline-offset-4 hover:underline"
                          >
                            {result.target}
                          </button>
                        </CardTitle>
                        {result.hostname && result.hostname !== result.target && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Hostname:</span> {result.hostname}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-sm text-muted-foreground font-medium">OS:</span>
                          <OSIcon osName={result.os} className="h-4 w-4" />
                          <span className="text-sm text-muted-foreground">{result.os}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Open Ports:</span>{" "}
                          {result.ports.filter((p) => p.state === "open").length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Total Scanned Ports:</span> {result.ports.length}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {result.traceroute && result.traceroute.length > 0 && (
                      <div className="mb-6">
                        <TracerouteSection traceroute={result.traceroute} />
                      </div>
                    )}

                    <PortResultsTable
                      ports={result.ports}
                      onPortClick={(port) => handlePortClick(port, result.target)}
                    />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <p>No scan results available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="nmap">
          <Card>
            <CardHeader>
              <CardTitle>Console</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-950 dark:bg-zinc-900 text-green-400 font-mono text-sm p-4 rounded-md h-[400px] overflow-auto whitespace-pre-wrap">
                {scan.output || (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <p>No Console output available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GenerateReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onConfirm={handleGenerateReport}
        scan={scan}
      />

      <DeleteScanDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteScan}
        scan={scan}
      />

      <ScriptDetailsDialog
        isOpen={isScriptDialogOpen}
        onClose={() => setIsScriptDialogOpen(false)}
        port={selectedPort || {}}
        target={selectedTarget}
      />
    </div>
  )
}
