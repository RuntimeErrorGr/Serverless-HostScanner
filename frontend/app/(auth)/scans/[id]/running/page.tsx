"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorProgressBar } from "@/components/color-progress-bar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, Calendar, Target } from "lucide-react"
import { scansAPI } from "@/lib/api"
import { formatToBucharestTime, formatElapsedTime } from "@/lib/timezone"
import { ParameterSection } from "@/components/parameter-section"

// Type for scan data
interface ScanData {
  scan_uuid: string;
  status: string;
  type: string;
  parameters?: Record<string, any>;
  output?: string;
  targets: string[];
  created_at: string;
  started_at?: string;
  finished_at?: string;
  name?: string;
  current_progress?: number;  // Add current progress from API
}

const initialScanData: ScanData = {
  scan_uuid: "",
  status: "pending",
  type: "",
  parameters: {},
  output: "",
  targets: [],
  created_at: ""
};

export default function PendingRunningScanPage() {
  const params = useParams()
  const router = useRouter()
  const scanId = params.id as string
  const [scan, setScan] = useState(initialScanData)
  const [progress, setProgress] = useState<number>(0)
  const [nmapOutput, setNmapOutput] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [redirecting, setRedirecting] = useState<boolean>(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const [elapsedTime, setElapsedTime] = useState<string>("0s")

  // Real-time cronometer effect using timezone utility
  useEffect(() => {
    if (!scan.started_at) return;
    
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(scan.started_at));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [scan.started_at]);

  // Fetch initial scan data from the API
  useEffect(() => {
    if (!scanId) return;

    async function fetchScanData() {
      try {
        setIsLoading(true);
        const scanData = await scansAPI.getScan(scanId);
        
        setScan(scanData);
        
        // Set initial progress if available from API (for page refreshes)
        if (scanData.current_progress !== undefined) {
          setProgress(scanData.current_progress);
        }
        
        // Initialize output from database if it exists
        if (scanData.output) {
          setNmapOutput(scanData.output);
        }
        
        // If scan is already completed or failed, handle redirect quickly
        if (scanData.status === "completed" || scanData.status === "failed") {
          setProgress(100);
          handleRedirect();
        }
      } catch (err) {
        console.error("Error fetching scan data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchScanData();
  }, [scanId, router]);

  // Establish a real WebSocket connection to stream scan output, progress & status
  useEffect(() => {
    if (!scanId) return

    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const wsUrl = `${protocol}://${window.location.host}/api/scans/ws/${scanId}`

    console.log(`Connecting to WebSocket ${wsUrl}`)

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log("WebSocket connection established")
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === "progress") {
          const value = Number(message.value)
          if (!isNaN(value)) {
            setProgress((prev: number) => (value > prev ? value : prev))
            
            // If progress > 0 and we don't have a start time, refresh scan data
            if (value > 0 && !scan.started_at) {
              refreshScanData();
            }
          }
        } else if (message.type === "status") {
          const newStatus: string = message.value;

          setScan((prev) => ({
            ...prev,
            status: newStatus,
            started_at: message.started_at || prev.started_at,
            finished_at: message.finished_at || prev.finished_at,
            name: prev.name,
          }));

          if (newStatus === "completed" || newStatus === "failed") {
            setProgress(100);
            handleRedirect();
          }
        } else if (message.type === "output") {
          setNmapOutput((prev: string) => prev + message.value + "\n")
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message", err)
      }
    }

    ws.onerror = (err) => {
      console.error("WebSocket error", err)
    }

    ws.onclose = () => {
      console.log("WebSocket connection closed")
    }

    // Cleanup on component unmount
    return () => {
      ws.close()
    }
  }, [scanId])

  // Function to refresh scan data (for start time updates)
  const refreshScanData = async () => {
    try {
      const data = await scansAPI.getScan(scanId);
      setScan(prev => ({
        ...prev,
        started_at: data.started_at,
        status: data.status,
        name: data.name
      }));
    } catch (err) {
      console.error('Error refreshing scan data:', err);
    }
  };

  // Handle redirection to results page
  const handleRedirect = () => {
    if (!redirecting) {
      setRedirecting(true);
      setProgress(100);
      setTimeout(() => {
        router.push(`/scans/${scanId}`);
      }, 1200);
    }
  };

  // Auto-scroll to bottom of Nmap output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [nmapOutput])

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {scan.status === "running" ? "Running" : "Pending"} {scan.name || "Scan"}
            </h1>
            <p className="text-muted-foreground">Monitoring scan progress in real-time</p>
          </div>
          {redirecting && (
            <div className="text-sm text-muted-foreground animate-pulse">
              Redirecting to results...
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Scan Progress</CardTitle>
            <Badge variant={scan.status === "running" ? "default" : scan.status === "completed" ? "secondary" : "outline"}>
              {scan.status === "running" || (scan.status === "pending" && progress > 0) ? (
                <span className="flex items-center">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Running
                </span>
              ) : scan.status === "completed" ? (
                "Completed"
              ) : (
                "Pending"
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <ColorProgressBar value={progress} max={100} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center">
                <Calendar className="h-3 w-3 text-muted-foreground mr-1" />
                <span className="text-muted-foreground mr-2">Start Time:</span>
                <span>{scan.started_at ? formatToBucharestTime(scan.started_at) : 'Not started'}</span>
              </div>
              <div className="flex items-center">
                <Target className="h-3 w-3 text-muted-foreground mr-1" />
                <span className="text-muted-foreground mr-2">Targets:</span>
                <span>{scan.targets.length}</span>
              </div>
              {scan.started_at && (
                <div className="flex items-center">
                  <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                  <span className="text-muted-foreground mr-2">Elapsed:</span>
                  <span>{elapsedTime}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="console">
        <TabsList>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="parameters">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scan Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  {scan.targets.map((target, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30"
                    >
                      <div className="flex items-center">
                        <Target className="h-3 w-3 text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {target}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Scan Parameters</CardTitle>
              </CardHeader>
              <CardContent>
                <ParameterSection
                  parameters={scan.type === 'custom' ? (scan.parameters || {}) : getDefaultScanParameters(scan.type || '')}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="console">
          <Card>
            <CardHeader>
              <CardTitle>Console</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={outputRef}
                className="bg-zinc-950 dark:bg-zinc-900 text-green-400 font-mono text-sm p-4 rounded-md h-[400px] overflow-auto whitespace-pre-wrap"
              >
                {nmapOutput || "Waiting for output..."}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Results will be available when the scan completes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Function to get default/deep scan parameters
const getDefaultScanParameters = (scanType: string) => {
  if (scanType === 'default') {
    return {
      echo_request: true,
      tcp_syn_scan: true,
      tcp_ports: "top-100",
      timing_flag: 5,
    }
  } else if (scanType === 'deep') {
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
      udp_ports: "top-100"
    }
  }
  return {}
}
