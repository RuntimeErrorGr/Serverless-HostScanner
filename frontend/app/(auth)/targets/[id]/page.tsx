"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock data for a target
const mockTargetData = {
  id: "target-1",
  name: "example.com",
  type: "hostname",
  value: "example.com",
  dateAdded: new Date(Date.now() - 5000000000).toISOString(),
  totalScans: 5,
  scans: [
    {
      id: "scan-1",
      name: "Scan 1",
      status: "completed",
      startTime: new Date(Date.now() - 4000000000).toISOString(),
      endTime: new Date(Date.now() - 3990000000).toISOString(),
      openPorts: 3,
    },
    {
      id: "scan-2",
      name: "Scan 2",
      status: "completed",
      startTime: new Date(Date.now() - 3000000000).toISOString(),
      endTime: new Date(Date.now() - 2990000000).toISOString(),
      openPorts: 4,
    },
    {
      id: "scan-3",
      name: "Scan 3",
      status: "completed",
      startTime: new Date(Date.now() - 2000000000).toISOString(),
      endTime: new Date(Date.now() - 1990000000).toISOString(),
      openPorts: 2,
    },
    {
      id: "scan-4",
      name: "Scan 4",
      status: "completed",
      startTime: new Date(Date.now() - 1000000000).toISOString(),
      endTime: new Date(Date.now() - 990000000).toISOString(),
      openPorts: 5,
    },
    {
      id: "scan-5",
      name: "Scan 5",
      status: "running",
      startTime: new Date(Date.now() - 100000000).toISOString(),
      endTime: null,
      openPorts: 0,
    },
  ],
  ports: [
    { port: 80, protocol: "tcp", service: "http", count: 5 },
    { port: 443, protocol: "tcp", service: "https", count: 5 },
    { port: 22, protocol: "tcp", service: "ssh", count: 3 },
    { port: 21, protocol: "tcp", service: "ftp", count: 2 },
    { port: 3389, protocol: "tcp", service: "ms-wbt-server", count: 1 },
  ],
}

export default function TargetDetailPage() {
  const params = useParams()
  const targetId = params.id as string
  const [target, setTarget] = useState(mockTargetData)

  // Fetch target data
  useEffect(() => {
    // In a real app, you would fetch the target data from the API
    console.log(`Fetching target data for ${targetId}...`)
  }, [targetId])

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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="mt-1 capitalize">{target.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Value</p>
              <p className="mt-1">{target.value}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date Added</p>
              <p className="mt-1">{new Date(target.dateAdded).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
              <p className="mt-1">{target.totalScans}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="scans">
        <TabsList>
          <TabsTrigger value="scans">Scan History</TabsTrigger>
          <TabsTrigger value="ports">Discovered Ports</TabsTrigger>
        </TabsList>
        <TabsContent value="scans">
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scan Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Open Ports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {target.scans.map((scan) => (
                    <TableRow key={scan.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>{scan.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div
                            className={`h-2 w-2 rounded-full mr-2 ${
                              scan.status === "completed"
                                ? "bg-green-500"
                                : scan.status === "running"
                                  ? "bg-blue-500"
                                  : scan.status === "pending"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                            }`}
                          />
                          <span className="capitalize">{scan.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(scan.startTime).toLocaleString()}</TableCell>
                      <TableCell>{scan.endTime ? new Date(scan.endTime).toLocaleString() : "-"}</TableCell>
                      <TableCell>{scan.openPorts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ports">
          <Card>
            <CardHeader>
              <CardTitle>Discovered Ports</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Port</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Times Discovered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {target.ports.map((port, index) => (
                    <TableRow key={index}>
                      <TableCell>{port.port}</TableCell>
                      <TableCell>{port.protocol}</TableCell>
                      <TableCell>{port.service}</TableCell>
                      <TableCell>{port.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
