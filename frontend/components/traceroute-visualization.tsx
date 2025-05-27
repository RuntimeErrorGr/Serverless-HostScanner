"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Network, TableIcon, Router, Globe, ArrowRight, Wifi, Server, MapIcon } from "lucide-react"

interface TracerouteHop {
  ttl: string
  ipaddr: string
  rtt: string
  host: string
}

interface TracerouteVisualizationProps {
  data: TracerouteHop[]
}

const getHopType = (hop: TracerouteHop, index: number, total: number) => {
  if (index === 0) return "source"
  if (index === total - 1) return "destination"
  if (hop.ipaddr.startsWith("192.168.") || hop.ipaddr.startsWith("10.") || hop.ipaddr.startsWith("172.")) {
    return "private"
  }
  return "public"
}

const getHopIcon = (type: string) => {
  switch (type) {
    case "source":
      return <Wifi className="h-4 w-4" />
    case "destination":
      return <Server className="h-4 w-4" />
    case "private":
      return <Router className="h-4 w-4" />
    case "public":
      return <Globe className="h-4 w-4" />
    default:
      return <Router className="h-4 w-4" />
  }
}

const getHopColor = (type: string) => {
  switch (type) {
    case "source":
      return "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
    case "destination":
      return "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
    case "private":
      return "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
    case "public":
      return "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300"
    default:
      return "bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300"
  }
}

const getRTTColor = (rtt: number) => {
  if (rtt < 10) return "text-green-600 dark:text-green-400"
  if (rtt < 50) return "text-yellow-600 dark:text-yellow-400"
  if (rtt < 100) return "text-orange-600 dark:text-orange-400"
  return "text-red-600 dark:text-red-400"
}

const NetworkVisualization = ({ data }: { data: TracerouteHop[] }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Network className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Network Path ({data.length} hops)</span>
        </div>
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Source</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Private</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Public</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Target</span>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[400px] w-full">
        <div className="p-4 space-y-3">
          {data.map((hop, index) => {
            const hopType = getHopType(hop, index, data.length)
            const rtt = Number.parseFloat(hop.rtt)
            const isLast = index === data.length - 1

            return (
              <div key={index} className="flex items-center space-x-3">
                {/* Hop Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                  {hop.ttl}
                </div>

                {/* Hop Details Card */}
                <div className={`flex-1 p-3 rounded-lg border-2 ${getHopColor(hopType)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getHopIcon(hopType)}
                      <div>
                        <div className="font-mono text-sm font-medium">{hop.ipaddr}</div>
                        {hop.host && <div className="text-xs opacity-75 font-mono">{hop.host}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getRTTColor(rtt)}`}>{hop.rtt}ms</div>
                      <div className="text-xs opacity-75">
                        {hopType === "source" && "Origin"}
                        {hopType === "destination" && "Target"}
                        {hopType === "private" && "LAN"}
                        {hopType === "public" && "Internet"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow to next hop */}
                {!isLast && (
                  <div className="flex-shrink-0">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">{data.length}</div>
          <div className="text-xs text-muted-foreground">Total Hops</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">
            {Math.min(...data.map((h) => Number.parseFloat(h.rtt))).toFixed(1)}ms
          </div>
          <div className="text-xs text-muted-foreground">Min RTT</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">
            {Math.max(...data.map((h) => Number.parseFloat(h.rtt))).toFixed(1)}ms
          </div>
          <div className="text-xs text-muted-foreground">Max RTT</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">
            {(data.reduce((sum, h) => sum + Number.parseFloat(h.rtt), 0) / data.length).toFixed(1)}ms
          </div>
          <div className="text-xs text-muted-foreground">Avg RTT</div>
        </div>
      </div>
    </div>
  )
}

const TracerouteTable = ({ data }: { data: TracerouteHop[] }) => (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Network path to target ({data.length} hops)</p>
    <ScrollArea className="h-[300px] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Hop</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>Hostname</TableHead>
            <TableHead className="w-24">RTT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((hop, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-center">{hop.ttl}</TableCell>
              <TableCell className="font-mono">{hop.ipaddr}</TableCell>
              <TableCell className="font-mono text-muted-foreground">{hop.host || "-"}</TableCell>
              <TableCell className="font-mono text-right">{hop.rtt}ms</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  </div>
)

export function TracerouteVisualization({ data }: TracerouteVisualizationProps) {
  const [activeTab, setActiveTab] = useState("visualization")

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No traceroute data available</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visualization" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>Network Path</span>
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center space-x-2">
            <TableIcon className="h-4 w-4" />
            <span>Data Table</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="mt-4">
          <NetworkVisualization data={data} />
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <TracerouteTable data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
