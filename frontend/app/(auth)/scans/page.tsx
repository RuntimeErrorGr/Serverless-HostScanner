"use client"

import { useState } from "react"
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
import { Plus, MoreHorizontal, FileText, Trash2, Search } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { scansAPI } from "@/lib/api"

// Mock data for scans - can be empty for testing empty state
const mockScans = Array.from({ length: 20 }).map((_, i) => ({
  id: `scan-${i + 1}`,
  name: `Scan ${i + 1}`,
  targets: Math.floor(Math.random() * 10) + 1,
  status: ["completed", "running", "pending", "failed"][Math.floor(Math.random() * 4)],
  startTime: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  endTime: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
  progress: Math.floor(Math.random() * 100),
}))

// Format scan options from form data
const formatScanOptions = (values: any) => {
  const scanOptions: any = {};

  // Add detection technique
  if (values.detectionTechnique) {
    const detectionMapping: Record<string, boolean> = {
      'syn': values.detectionTechnique === 'syn',
      'connect': values.detectionTechnique === 'connect',
      'ack': values.detectionTechnique === 'ack',
      'window': values.detectionTechnique === 'window',
      'maimon': values.detectionTechnique === 'maimon',
      'null': values.detectionTechnique === 'null',
      'fin': values.detectionTechnique === 'fin',
      'xmas': values.detectionTechnique === 'xmas'
    };

    scanOptions.tcp_syn_scan = detectionMapping.syn;
    scanOptions.tcp_ack_scan = detectionMapping.ack;
    scanOptions.tcp_connect_scan = detectionMapping.connect;
    scanOptions.tcp_window_scan = detectionMapping.window;
    scanOptions.tcp_null_scan = detectionMapping.null;
    scanOptions.tcp_fin_scan = detectionMapping.fin;
    scanOptions.tcp_xmas_scan = detectionMapping.xmas;
  } else {
    // Default to SYN scan if not specified
    scanOptions.tcp_syn_scan = true;
  }

  // Add host discovery probes
  if (values.hostDiscoveryProbes) {
    scanOptions.echo_request = values.hostDiscoveryProbes.includes('echo');
    scanOptions.timestamp_request = values.hostDiscoveryProbes.includes('timestamp');
    scanOptions.address_mask_request = values.hostDiscoveryProbes.includes('netmask');
  }

  // Add detection options
  if (values.options) {
    scanOptions.os_detection = values.options.includes('os-detection');
    scanOptions.service_version = values.options.includes('version-detection');
    scanOptions.ssl_scan = values.options.includes('ssl-scan');
    scanOptions.http_headers = values.options.includes('http-headers');
    scanOptions.traceroute = values.options.includes('traceroute');
  }

  // Add timing
  if (values.timing) {
    scanOptions.timing_flag = parseInt(values.timing.replace('T', ''));
  } else {
    // Ensure timing flag is always set with a default value if not specified
    scanOptions.timing_flag = 3; // Default to T3 (Normal) timing
  }

  // Add port specifications
  if (values.portTypes && values.portTypes.includes('tcp')) {
    if (values.tcpTopPorts && values.tcpTopPorts !== 'disabled') {
      scanOptions.tcp_ports = `top-${values.tcpTopPorts}`;
    } else if (values.tcpPorts) {
      scanOptions.tcp_ports = values.tcpPorts;
    }
  }

  if (values.portTypes && values.portTypes.includes('udp')) {
    if (values.udpTopPorts && values.udpTopPorts !== 'disabled') {
      scanOptions.udp_ports = `top-${values.udpTopPorts}`;
    } else if (values.udpPorts) {
      scanOptions.udp_ports = values.udpPorts;
    }
  }

  return scanOptions;
};

export default function ScansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isStartScanModalOpen, setIsStartScanModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [selectedScan, setSelectedScan] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(false)

  // For testing empty state, uncomment the next line
  // const scans: typeof mockScans = []
  const scans = mockScans

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentScans = scans.slice(startIndex, endIndex)
  const totalPages = Math.ceil(scans.length / itemsPerPage)

  const handleScanClick = (scan: any) => {
    if (scan.status === "running" || scan.status === "pending") {
      router.push(`/scans/${scan.id}/running`)
    } else {
      router.push(`/scans/${scan.id}`)
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

  const confirmDeleteScan = () => {
    // API call would go here
    toast({
      variant: "success",
      title: "Scan deleted",
      description: `Scan ${selectedScan.name} has been deleted.`,
    })
    setIsDeleteDialogOpen(false)
  }

  const confirmGenerateReport = (format: string) => {
    // API call would go here
    toast({
      variant: "success",
      title: "Report generated",
      description: `${format.toUpperCase()} report for ${selectedScan.name} has been generated.`,
    })
    setIsReportDialogOpen(false)
    router.push("/reports")
  }

  const handleStartScan = async (values: any) => {
    try {
      setIsLoading(true);
      
      // Parse targets from comma-separated string to array
      const targets = values.targets
        .split(/[,\n]/)
        .map((t: string) => t.trim())
        .filter(Boolean);

      // Format scan type
      const scanType = values.scanType;
      
      // Format scan options
      const scanOptions = formatScanOptions(values);

      // Prepare payload for API
      const payload = {
        targets,
        type: scanType,
        scan_options: scanOptions
      };

      console.log('Sending scan request:', payload);

      // Use the scansAPI helper which handles authentication
      const data = await scansAPI.startScan(payload);
      
      toast({
        title: "Scan started",
        description: "Your scan has been started successfully.",
        variant: "success",
      });
      
      // Redirect to running scan page
      router.push(`/scans/${data.scan_uuid}/running`);
    } catch (error) {
      console.error('Error starting scan:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start scan",
        variant: "error",
      });
    } finally {
      // Always close the modal and set loading to false, regardless of success or error
      setIsStartScanModalOpen(false);
      setIsLoading(false);
    }
  }

  const columns = [
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
    },
    {
      key: "targets",
      title: "Targets",
      sortable: true,
      filterable: true,
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
              row.status === "completed"
                ? "bg-green-500"
                : row.status === "running"
                  ? "bg-blue-500"
                  : row.status === "pending"
                    ? "bg-yellow-500"
                    : "bg-red-500"
            }`}
          />
          <span className="capitalize">{row.status}</span>
        </div>
      ),
    },
    {
      key: "startTime",
      title: "Start Time",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => new Date(row.startTime).toLocaleString(),
    },
    {
      key: "endTime",
      title: "End Time",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) =>
        row.status === "completed" || row.status === "failed" ? new Date(row.endTime).toLocaleString() : "-",
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
              disabled={row.status !== "completed"}
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
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Scan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Manage and view your network scans</p>
        </div>
        <Button onClick={() => setIsStartScanModalOpen(true)} disabled={isLoading}>
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
                <Button onClick={() => setIsStartScanModalOpen(true)} disabled={isLoading}>
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
