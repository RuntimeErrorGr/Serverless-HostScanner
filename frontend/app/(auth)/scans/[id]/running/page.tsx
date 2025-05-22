"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorProgressBar } from "@/components/color-progress-bar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { scansAPI } from "@/lib/api"

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
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  // Fetch initial scan data from the API
  useEffect(() => {
    if (!scanId) return;
    
    async function fetchScanData() {
      try {
        setIsLoading(true);
        const data = await scansAPI.getScan(scanId);
        
        setScan(data);
        
        // Initialize output from database if it exists
        if (data.output) {
          setNmapOutput(data.output);
        }
        
        // If scan is already completed or failed, set progress to 100% and redirect
        if (data.status === "completed" || data.status === "failed") {
          setProgress(100);
          // Add slight delay then redirect to results page
          handleRedirect();
        } else {
          // Start polling the status endpoint
          startStatusPolling();
        }
      } catch (err) {
        console.error('Error fetching scan data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchScanData();
    
    // Clean up polling interval on unmount
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [scanId, router]);

  // Establish a real WebSocket connection to stream scan output & progress
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
            // Make sure the progress bar never decreases
            setProgress((prev: number) => (value > prev ? value : prev))
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

  // Poll the status endpoint to check for completion
  const startStatusPolling = () => {
    // Cancel any existing polling
    if (statusPolling) {
      clearInterval(statusPolling);
    }
    
    const interval = setInterval(async () => {
      try {
        const data = await scansAPI.getScanStatus(scanId);
        
        // Update the scan status in our local state
        setScan(prev => ({ ...prev, status: data.status }));
        
        // If scan is complete or failed, handle redirect
        if (data.status === "completed" || data.status === "failed") {
          handleRedirect();
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling scan status:', err);
      }
    }, 5000); // Poll every 5 seconds
    
    setStatusPolling(interval);
  };
  
  // Handle redirection to results page
  const handleRedirect = () => {
    if (!redirecting) {
      setRedirecting(true);
      setProgress(100);
      setTimeout(() => {
        router.push(`/scans/${scanId}`);
      }, 3200);
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
            <h1 className="text-3xl font-bold tracking-tight">Running Scan</h1>
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
            <Badge variant={scan.status === "running" ? "default" : scan.status === "completed" ? "success" : "secondary"}>
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

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start Time:</span>
                <span className="ml-2">{scan.started_at ? new Date(scan.started_at).toLocaleString() : 'Not started'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Targets:</span>
                <span className="ml-2">{scan.targets.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output">Nmap Output</TabsTrigger>
          <TabsTrigger value="results">Scan Results</TabsTrigger>
        </TabsList>
        <TabsContent value="output">
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
