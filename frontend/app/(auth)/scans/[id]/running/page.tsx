"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorProgressBar } from "@/components/color-progress-bar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

// Mock WebSocket connection and data
const mockScanData = {
  id: "scan-1",
  name: "Scan 1",
  targets: ["example.com", "192.168.1.1", "10.0.0.1-10"],
  status: "running",
  startTime: new Date().toISOString(),
  progress: 0,
  nmapOutput: "",
  results: [],
}

export default function PendingRunningScanPage() {
  const params = useParams()
  const scanId = params.id as string
  const [scan, setScan] = useState(mockScanData)
  const [progress, setProgress] = useState(0)
  const [nmapOutput, setNmapOutput] = useState("")
  const outputRef = useRef<HTMLDivElement>(null)

  // Simulate WebSocket connection and data updates
  useEffect(() => {
    const mockWebSocket = {
      onmessage: null as ((event: { data: string }) => void) | null,
      send: (data: string) => {
        console.log("WebSocket message sent:", data)
      },
      close: () => {
        console.log("WebSocket connection closed")
      },
    }

    // Simulate connecting to WebSocket
    console.log(`Connecting to WebSocket for scan ${scanId}...`)

    // Simulate receiving progress updates
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = Math.min(prev + Math.random() * 5, 99)
        return newProgress
      })
    }, 1000)

    // Simulate receiving Nmap output
    const outputInterval = setInterval(() => {
      const newLines = [
        "Starting Nmap 7.92 ( https://nmap.org ) at 2023-05-19 12:34 UTC",
        "Scanning example.com (93.184.216.34) [1000 ports]",
        "Discovered open port 80/tcp on 93.184.216.34",
        "Discovered open port 443/tcp on 93.184.216.34",
        "Scanning 192.168.1.1 [1000 ports]",
        "Discovered open port 22/tcp on 192.168.1.1",
        "Discovered open port 80/tcp on 192.168.1.1",
        "Discovered open port 443/tcp on 192.168.1.1",
        "Scanning 10.0.0.1 [1000 ports]",
        "Discovered open port 22/tcp on 10.0.0.1",
        "Discovered open port 3389/tcp on 10.0.0.1",
        "Service detection performed. Please report any incorrect results at https://nmap.org/submit/",
        "Nmap done: 3 IP addresses (3 hosts up) scanned in 25.62 seconds",
      ]

      const randomLine = newLines[Math.floor(Math.random() * newLines.length)]
      setNmapOutput((prev) => prev + randomLine + "\n")
    }, 2000)

    // Cleanup function
    return () => {
      clearInterval(progressInterval)
      clearInterval(outputInterval)
      mockWebSocket.close()
    }
  }, [scanId])

  // Auto-scroll to bottom of Nmap output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [nmapOutput])

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Running Scan</h1>
        <p className="text-muted-foreground">Monitoring scan progress in real-time</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Scan Progress</CardTitle>
            <Badge variant={scan.status === "running" ? "default" : "secondary"}>
              {scan.status === "running" ? (
                <span className="flex items-center">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Running
                </span>
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
                <span>{Math.round(progress)}%</span>
              </div>
              <ColorProgressBar value={progress} max={100} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start Time:</span>
                <span className="ml-2">{new Date(scan.startTime).toLocaleString()}</span>
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
              <CardTitle>Real-time Nmap Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={outputRef}
                className="bg-black text-green-400 font-mono text-sm p-4 rounded-md h-[400px] overflow-auto whitespace-pre-wrap"
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
