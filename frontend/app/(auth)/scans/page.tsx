"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/data-table/data-table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { StartScanModal } from "@/components/start-scan-modal"
import { DeleteScanDialog } from "@/components/delete-scan-dialog"
import { GenerateReportDialog } from "@/components/generate-report-dialog"
import { Plus, MoreHorizontal, FileText, Trash2, Search, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { scansAPI } from "@/lib/api"
import { formatToBucharestTime } from "@/lib/timezone"
import { ElapsedTimerCell } from "@/components/elapsed-cell"

// Format scan options from form data
const formatScanOptions = (values: any) => {
  const scanOptions: any = {}

  // Add detection technique
  if (values.detectionTechnique) {
    const detectionMapping: Record<string, boolean> = {
      syn: values.detectionTechnique === "syn",
      connect: values.detectionTechnique === "connect",
      ack: values.detectionTechnique === "ack",
      window: values.detectionTechnique === "window",
      maimon: values.detectionTechnique === "maimon",
      null: values.detectionTechnique === "null",
      fin: values.detectionTechnique === "fin",
      xmas: values.detectionTechnique === "xmas",
    }

    scanOptions.tcp_syn_scan = detectionMapping.syn
    scanOptions.tcp_ack_scan = detectionMapping.ack
    scanOptions.tcp_connect_scan = detectionMapping.connect
    scanOptions.tcp_window_scan = detectionMapping.window
    scanOptions.tcp_null_scan = detectionMapping.null
    scanOptions.tcp_fin_scan = detectionMapping.fin
    scanOptions.tcp_xmas_scan = detectionMapping.xmas
  } else {
    // Default to SYN scan if not specified
    scanOptions.tcp_syn_scan = true
  }

  // Add host discovery probes
  if (values.hostDiscoveryProbes) {
    scanOptions.echo_request = values.hostDiscoveryProbes.includes("echo")
    scanOptions.timestamp_request = values.hostDiscoveryProbes.includes("timestamp")
    scanOptions.address_mask_request = values.hostDiscoveryProbes.includes("netmask")
  }

  // Add detection options
  if (values.options) {
    scanOptions.os_detection = values.options.includes("os-detection")
    scanOptions.service_version = values.options.includes("version-detection")
    scanOptions.ssl_scan = values.options.includes("ssl-scan")
    scanOptions.http_headers = values.options.includes("http-headers")
    scanOptions.traceroute = values.options.includes("traceroute")
  }

  // Add timing
  if (values.timing) {
    scanOptions.timing_flag = Number.parseInt(values.timing.replace("T", ""))
  } else {
    // Ensure timing flag is always set with a default value if not specified
    scanOptions.timing_flag = 3 // Default to T3 (Normal) timing
  }

  // Add port specifications
  if (values.portTypes && values.portTypes.includes("tcp")) {
    if (values.tcpTopPorts && values.tcpTopPorts !== "disabled") {
      scanOptions.tcp_ports = `top-${values.tcpTopPorts}`
    } else if (values.tcpPorts) {
      scanOptions.tcp_ports = values.tcpPorts
    }
  }

  if (values.portTypes && values.portTypes.includes("udp")) {
    if (values.udpTopPorts && values.udpTopPorts !== "disabled") {
      scanOptions.udp_ports = `top-${values.udpTopPorts}`
    } else if (values.udpPorts) {
      scanOptions.udp_ports = values.udpPorts
    }
  }

  return scanOptions
}

export default function ScansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [scans, setScans] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStartScanModalOpen, setIsStartScanModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [selectedScan, setSelectedScan] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch scans data
  useEffect(() => {
    async function fetchScans() {
      try {
        setIsLoading(true)
        const data = await scansAPI.getScans()
        setScans(data)
      } catch (error) {
        console.error("Error fetching scans:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load scans. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchScans()
  }, [])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentScans = scans.slice(startIndex, endIndex)
  const totalPages = Math.ceil(scans.length / itemsPerPage)

  const handleScanClick = (scan: any) => {
    // status to lowercase
    if (scan.status.toLowerCase() === "running" || scan.status.toLowerCase() === "pending") {
      router.push(`/scans/${scan.uuid}/running`)
    } else {
      router.push(`/scans/${scan.uuid}`)
    }
  }

  const handleDeleteScan = (scan: any) => {
    setSelectedScan(scan)
    setIsDeleteDialogOpen(true)
  }

  const handleGenerateReport = (scan: any) => {
    setSelectedScan(scan)
    setIsReportDialogOpen(true)
  }

  const confirmDeleteScan = async () => {
    try {
      await scansAPI.deleteScan(selectedScan.uuid)
      setScans(scans.filter((scan) => scan.uuid !== selectedScan.uuid))
      toast({
        variant: "success",
        title: "Scan deleted",
        description: `Scan ${selectedScan.name} has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting scan:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete scan. Please try again.",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const confirmGenerateReport = async (format: string) => {
    try {
      await scansAPI.generateReport(selectedScan.uuid, format)
      toast({
        variant: "success",
        title: "Report generated",
        description: `${format.toUpperCase()} report for ${selectedScan.name} has been generated.`,
      })
      router.push("/reports")
    } catch (error) {
      console.error("Error generating report:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate report. Please try again.",
      })
    } finally {
      setIsReportDialogOpen(false)
    }
  }

  const handleStartScan = async (values: any) => {
    try {
      setIsSubmitting(true)

      // Parse targets from comma-separated string to array
      const targets = values.targets
        .split(/[,\n]/)
        .map((t: string) => t.trim())
        .filter(Boolean)

      // Format scan type
      const scanType = values.scanType

      // Format scan options
      const scanOptions = formatScanOptions(values)

      // Prepare payload for API
      const payload = {
        targets,
        type: scanType,
        scan_options: scanOptions,
      }

      console.log("Sending scan request:", payload)

      // Use the scansAPI helper which handles authentication
      const data = await scansAPI.startScan(payload)

      toast({
        title: "Scan started",
        description: "Your scan has been started successfully.",
        variant: "success",
      })

      // Redirect to running scan page
      router.push(`/scans/${data.scan_uuid}/running`)
    } catch (error) {
      console.error("Error starting scan:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start scan",
        variant: "destructive",
      })
    } finally {
      // Always close the modal and set loading to false, regardless of success or error
      setIsStartScanModalOpen(false)
      setIsSubmitting(false)
    }
  }

  const columns = [
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
      render: (row: any) => row.name,
    },
    {
      key: "targets",
      title: "Targets",
      sortable: true,
      filterable: true,
      render: (row: any) => {
        let targets = row.targets
        if (typeof targets === "string") {
          try {
            targets = JSON.parse(targets)
          } catch {
            targets = [targets]
          }
        }
        if (!Array.isArray(targets)) {
          targets = [targets]
        }
    
        const lines = targets.length > 3
          ? [...targets.slice(0, 3), "..."]
          : targets
    
        return (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {lines.join("\n")}
          </div>
        )
      },
    },    
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <div className="flex items-center">
          <div
            className={`h-2 w-2 rounded-full mr-2 ${
              row.status.toLowerCase() === "completed"
                ? "bg-green-500"
                : row.status.toLowerCase() === "running"
                  ? "bg-blue-500"
                  : row.status.toLowerCase() === "pending"
                    ? "bg-yellow-500"
                    : "bg-red-500"
            }`}
          />
          <span className="capitalize">{row.status.toLowerCase()}</span>
        </div>
      ),
    },
    {
      key: "created_at",
      title: "Start Time",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => formatToBucharestTime(row.created_at),
    },
    {
      key: "finished_at",
      title: "End Time",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) =>
        row.status.toLowerCase() === "completed" || row.status.toLowerCase() === "failed"
          ? formatToBucharestTime(row.finished_at)
          : "-",
    },
    {
      key: "duration",
      title: "Duration",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <ElapsedTimerCell
          startedAt={row.started_at}
          finishedAt={row.finished_at}
          status={row.status}
        />
      )
    },
    {
      key: "actions",
      title: "Actions",
      render: (row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleGenerateReport(row)
              }}
              disabled={row.status.toLowerCase() !== "completed"}
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteScan(row)
              }}
              className="text-red-600"
              disabled={row.status.toLowerCase() === "running" || row.status.toLowerCase() === "pending"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Scan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading scans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Manage and view your network scans</p>
        </div>
        <Button onClick={() => setIsStartScanModalOpen(true)} disabled={isSubmitting}>
          <Plus className="mr-2 h-4 w-4" /> Start New Scan
        </Button>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <DataTable
            data={currentScans}
            columns={columns}
            onRowClick={handleScanClick}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No scans found</h3>
                <p className="text-muted-foreground mt-2 mb-6">
                  You haven't run any network scans yet. Start your first scan to begin discovering network information.
                </p>
                <Button onClick={() => setIsStartScanModalOpen(true)} disabled={isSubmitting}>
                  <Plus className="mr-2 h-4 w-4" /> Start New Scan
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {scans.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, scans.length)} of {scans.length} scans
            </p>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <StartScanModal
        isOpen={isStartScanModalOpen}
        onClose={() => setIsStartScanModalOpen(false)}
        onSubmit={handleStartScan}
      />

      <DeleteScanDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteScan}
        scan={selectedScan}
      />

      <GenerateReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onConfirm={confirmGenerateReport}
        scan={selectedScan}
      />
    </div>
  )
}
