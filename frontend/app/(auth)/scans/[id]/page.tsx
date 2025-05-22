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

// Interface for scan data from the API
interface ScanData {
  scan_uuid: string;
  name: string;
  status: string;
  type: string;
  parameters?: Record<string, any>;
  output?: string;
  targets: string[];
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

interface TargetResult {
  target: string;
  os: string;
  ports: {
    port: number;
    protocol: string;
    service: string;
    state: string;
  }[];
}

interface Finding {
  id: number;
  name: string;
  description: string;
  recommendation: string;
  port: number;
  port_state: string;
  protocol: string;
  service: string;
  os: Record<string, any>;
  traceroute: string;
  severity: string;
  target_id: number;
  target?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
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
  const [findings, setFindings] = useState<Finding[]>([])
  const [targetResults, setTargetResults] = useState<TargetResult[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

  // Fetch scan data
  useEffect(() => {
    async function fetchScanData() {
      if (!scanId) return;
      
      try {
        setIsLoading(true);
        
        // Fetch scan details using the API
        const scanData = await scansAPI.getScan(scanId);
        setScan(scanData);
        
        // Get findings for this scan using the API
        try {
          const findingsData = await scansAPI.getScanFindings(scanId);
          setFindings(findingsData.data || []);
          
          // Process findings into target results
          const resultsMap = new Map<string, TargetResult>();
          
          for (const finding of findingsData.data || []) {
            const targetName = finding.target?.name || 'Unknown';
            
            if (!resultsMap.has(targetName)) {
              resultsMap.set(targetName, {
                target: targetName,
                os: finding.os?.name || 'Unknown',
                ports: []
              });
            }
            
            // Add port information if it's a port finding
            if (finding.port) {
              const targetResult = resultsMap.get(targetName)!;
              targetResult.ports.push({
                port: finding.port,
                protocol: finding.protocol || 'unknown',
                service: finding.service || 'unknown',
                state: finding.port_state || 'unknown'
              });
            }
          }
          
          setTargetResults(Array.from(resultsMap.values()));
        } catch (findingsErr) {
          console.error('Error fetching findings:', findingsErr);
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
          <p className="text-muted-foreground">Scan completed on {new Date(scan.finished_at).toLocaleString()}</p>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="mt-1 flex items-center">
                <Badge variant="success" className="mr-2">
                  {scan.status === "completed" ? "Completed" : scan.status === "failed" ? "Failed" : scan.status}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Time</p>
              <p className="mt-1">{scan.started_at ? new Date(scan.started_at).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Time</p>
              <p className="mt-1">{scan.finished_at ? new Date(scan.finished_at).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="mt-1">
                {scan.started_at && scan.finished_at 
                  ? Math.round((new Date(scan.finished_at).getTime() - new Date(scan.started_at).getTime()) / 60000) + ' minutes'
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="nmap">Nmap Output</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>
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
                    <div className="mb-2">
                      <span className="text-sm font-medium text-muted-foreground mr-2">OS:</span>
                      <span>{result.os}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Port</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.ports.map((port, portIndex) => (
                          <TableRow key={portIndex}>
                            <TableCell>{port.port}</TableCell>
                            <TableCell>{port.protocol}</TableCell>
                            <TableCell>{port.service}</TableCell>
                            <TableCell>
                              <Badge variant={port.state === "open" ? "success" : "secondary"}>{port.state}</Badge>
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
              <CardTitle>Nmap Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-950 dark:bg-zinc-900 text-green-400 font-mono text-sm p-4 rounded-md h-[400px] overflow-auto whitespace-pre-wrap">
                {scan.output || (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <p>No Nmap output available</p>
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
                      <TableHead>Open Ports</TableHead>
                      <TableHead>OS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.target}</TableCell>
                        <TableCell>{result.ports.filter((p) => p.state === "open").length}</TableCell>
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
