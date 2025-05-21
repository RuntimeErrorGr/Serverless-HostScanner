"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GenerateReportDialog } from "@/components/generate-report-dialog"
import { FileText } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

// Mock data for a completed scan
const mockScanData = {
  id: "scan-1",
  name: "Scan 1",
  targets: ["example.com", "192.168.1.1", "10.0.0.1"],
  status: "completed",
  startTime: new Date(Date.now() - 3600000).toISOString(),
  endTime: new Date().toISOString(),
  nmapOutput: `Starting Nmap 7.92 ( https://nmap.org ) at 2023-05-19 12:34 UTC
Scanning example.com (93.184.216.34) [1000 ports]
Discovered open port 80/tcp on 93.184.216.34
Discovered open port 443/tcp on 93.184.216.34
Scanning 192.168.1.1 [1000 ports]
Discovered open port 22/tcp on 192.168.1.1
Discovered open port 80/tcp on 192.168.1.1
Discovered open port 443/tcp on 192.168.1.1
Scanning 10.0.0.1 [1000 ports]
Discovered open port 22/tcp on 10.0.0.1
Discovered open port 3389/tcp on 10.0.0.1
Service detection performed. Please report any incorrect results at https://nmap.org/submit/
Nmap done: 3 IP addresses (3 hosts up) scanned in 25.62 seconds`,
  results: [
    {
      target: "example.com (93.184.216.34)",
      ports: [
        { port: 80, protocol: "tcp", service: "http", state: "open" },
        { port: 443, protocol: "tcp", service: "https", state: "open" },
      ],
      os: "Linux 3.x",
    },
    {
      target: "192.168.1.1",
      ports: [
        { port: 22, protocol: "tcp", service: "ssh", state: "open" },
        { port: 80, protocol: "tcp", service: "http", state: "open" },
        { port: 443, protocol: "tcp", service: "https", state: "open" },
      ],
      os: "Cisco IOS 15.x",
    },
    {
      target: "10.0.0.1",
      ports: [
        { port: 22, protocol: "tcp", service: "ssh", state: "open" },
        { port: 3389, protocol: "tcp", service: "ms-wbt-server", state: "open" },
      ],
      os: "Windows Server 2019",
    },
  ],
}

export default function FinishedScanPage() {
  const params = useParams()
  const scanId = params.id as string
  const [scan, setScan] = useState(mockScanData)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

  // Fetch scan data
  useEffect(() => {
    // In a real app, you would fetch the scan data from the API
    console.log(`Fetching scan data for ${scanId}...`)
  }, [scanId])

  const handleGenerateReport = (format: string) => {
    // API call would go here
    toast({
      variant: "success",
      title: "Report generated",
      description: `${format.toUpperCase()} report for ${scan.name} has been generated.`,
    })
    setIsReportDialogOpen(false)
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{scan.name}</h1>
          <p className="text-muted-foreground">Scan completed on {new Date(scan.endTime).toLocaleString()}</p>
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
                  Completed
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Time</p>
              <p className="mt-1">{new Date(scan.startTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Time</p>
              <p className="mt-1">{new Date(scan.endTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="mt-1">
                {Math.round((new Date(scan.endTime).getTime() - new Date(scan.startTime).getTime()) / 60000)} minutes
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
              {scan.results.length > 0 ? (
                scan.results.map((result, index) => (
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
                {scan.nmapOutput || (
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
              {scan.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Open Ports</TableHead>
                      <TableHead>OS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scan.results.map((result, index) => (
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
