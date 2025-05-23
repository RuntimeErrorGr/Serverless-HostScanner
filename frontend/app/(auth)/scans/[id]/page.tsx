"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GenerateReportDialog } from "@/components/generate-report-dialog"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { scansAPI } from "@/lib/api"
import { formatToBucharestTime, formatDuration } from "@/lib/timezone"
import { ParameterSection } from "@/components/parameter-section"

// Interface for scan data from the API
interface ScanData {
  scan_uuid: string;
  name: string;
  status: string;
  type: string;
  parameters?: Record<string, any>;
  output?: string;
  result?: ScanResult[];
  targets: string[];
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

interface ScanResult {
  ip_address: string;
  hostname: string;
  status: string;
  last_seen: string;
  reason: string;
  os_info: {
    name?: string;
    accuracy?: string;
    classes?: Array<{
      type: string;
      vendor: string;
      osfamily: string;
      osgen: string;
      accuracy: string;
    }>;
  };
  ports: Array<{
    port: number | null;
    protocol: string;
    state: string;
    service: {
      name?: string;
      product?: string;
      version?: string;
      method?: string;
      conf?: string;
    };
    scripts: Record<string, string>;
    count?: number;
  }>;
  traceroute: Array<{
    ttl: string;
    ipaddr: string;
    rtt: string;
    host: string;
  }>;
  ssl_info: Record<string, any>;
  http_headers: Record<string, any>;
}

interface TargetResult {
  target: string;
  hostname: string;
  os: string;
  traceroute: Array<{
    ttl: string;
    ipaddr: string;
    rtt: string;
    host: string;
  }>;
  ports: {
    port: number;
    protocol: string;
    service: string;
    state: string;
    product?: string;
    version?: string;
  }[];
}

// Default empty state
const initialScanData: ScanData = {
  scan_uuid: "",
  name: "",
  status: "",
  type: "",
  targets: [],
  created_at: ""
}

export default function FinishedScanPage() {
  const params = useParams()
  const scanId = params.id as string
  const [scan, setScan] = useState<ScanData>(initialScanData)
  const [targetResults, setTargetResults] = useState<TargetResult[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

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

  // Fetch scan data
  useEffect(() => {
    async function fetchScanData() {
      if (!scanId) return;
      
      try {
        setIsLoading(true);
        
        // Fetch scan details using the API
        const scanData = await scansAPI.getScan(scanId);
        setScan(scanData);
        
        // Process scan results into target results
        if (scanData.result && scanData.result.length > 0) {
          const results: TargetResult[] = scanData.result.map((host: ScanResult) => {
            const targetName = host.hostname || host.ip_address;
            const osName = host.os_info?.name || 
                          (host.os_info?.classes && host.os_info.classes.length > 0 
                            ? `${host.os_info.classes[0].vendor} ${host.os_info.classes[0].osfamily} ${host.os_info.classes[0].osgen}`.trim()
                            : 'Unknown');
            
            // Filter out synthetic extraports entries and extract real ports
            const realPorts = host.ports
              .filter(port => port.port !== null)
              .map(port => ({
                port: port.port!,
                protocol: port.protocol,
                service: port.service?.name || 'unknown',
                state: port.state,
                product: port.service?.product,
                version: port.service?.version
              }))
              // Sort ports: open first, then others
              .sort((a, b) => {
                if (a.state === 'open' && b.state !== 'open') return -1;
                if (a.state !== 'open' && b.state === 'open') return 1;
                return a.port - b.port; // Secondary sort by port number
              });
            
            return {
              target: targetName,
              hostname: host.hostname,
              os: osName,
              traceroute: host.traceroute || [],
              ports: realPorts
            };
          });
          
          setTargetResults(results);
        }
      } catch (err) {
        console.error('Error fetching scan data:', err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load scan data. Please try again."
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchScanData();
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

  // Function to get port state badge variant and color
  const getPortStateBadge = (state: string) => {
    switch (state.toLowerCase()) {
      case 'open':
        return { variant: 'default', className: 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/30' };
      case 'closed':
        return { variant: 'default', className: 'bg-red-500 hover:bg-red-600 text-white' };
      case 'filtered':
      case 'unknown':
      default:
        return { variant: 'secondary', className: '' };
    }
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
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{scan.name}</h1>
          <p className="text-muted-foreground">Scan completed on {formatToBucharestTime(scan.finished_at)}</p>
        </div>
        <Button onClick={() => setIsReportDialogOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
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
                <Badge variant="outline">
                  {scan.type?.charAt(0).toUpperCase() + scan.type?.slice(1) || 'Unknown'}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Time</p>
              <p className="mt-1">{formatToBucharestTime(scan.started_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Time</p>
              <p className="mt-1">{formatToBucharestTime(scan.finished_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="mt-1">
                {scan.started_at && scan.finished_at 
                  ? formatDuration(scan.started_at, scan.finished_at)
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="nmap">Console</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>
        <TabsContent value="parameters">
          <Card>
            <CardHeader>
              <CardTitle>Scan Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <ParameterSection
                parameters={scan.type === 'custom' 
                  ? scan.parameters 
                  : getDefaultScanParameters(scan.type || '')}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
            </CardHeader>
            <CardContent>
              {targetResults.length > 0 ? (
                targetResults.map((result, index) => (
                  <div key={index} className="mb-6 last:mb-0">
                    <h3 className="text-lg font-medium mb-2">{result.target}</h3>
                    {result.hostname && result.hostname !== result.target && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-muted-foreground mr-2">Hostname:</span>
                        <span>{result.hostname}</span>
                      </div>
                    )}
                    <div className="mb-2">
                      <span className="text-sm font-medium text-muted-foreground mr-2">OS:</span>
                      <span>{result.os}</span>
                    </div>
                    {result.traceroute && result.traceroute.length > 0 && (
                      <div className="mb-4">
                        <span className="text-sm font-medium text-muted-foreground mr-2">Traceroute:</span>
                        <div className="mt-2 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md">
                          <div className="font-mono text-xs space-y-1">
                            {result.traceroute.map((hop, hopIndex) => (
                              <div key={hopIndex}>
                                {hop.ttl}. {hop.ipaddr} ({hop.rtt}ms) {hop.host && `(${hop.host})`}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Port</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.ports.map((port, portIndex) => (
                          <TableRow key={portIndex}>
                            <TableCell>{port.port}</TableCell>
                            <TableCell>{port.protocol}</TableCell>
                            <TableCell>{port.service}</TableCell>
                            <TableCell>{port.product && port.version ? `${port.product} ${port.version}` : port.product || '-'}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={getPortStateBadge(port.state).variant as any}
                                className={getPortStateBadge(port.state).className}
                              >
                                {port.state}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <p>No scan results available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
        <TabsContent value="targets">
          <Card>
            <CardHeader>
              <CardTitle>Targets</CardTitle>
            </CardHeader>
            <CardContent>
              {targetResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Open Ports</TableHead>
                      <TableHead>Total Discovered Ports</TableHead>
                      <TableHead>OS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.target}</TableCell>
                        <TableCell>{result.hostname || '-'}</TableCell>
                        <TableCell>{result.ports.filter((p) => p.state === "open").length}</TableCell>
                        <TableCell>{result.ports.length}</TableCell>
                        <TableCell>{result.os}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <p>No target information available</p>
                  </div>
                </div>
              )}
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
    </div>
  )
}
