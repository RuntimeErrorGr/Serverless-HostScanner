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
import { DeleteTargetDialog } from "@/components/delete-target-dialog"
import { AddTargetDialog } from "@/components/add-target-dialog"
import { StartScanModal } from "@/components/start-scan-modal"
import { BulkDeleteDialog } from "@/components/bulk-delete-dialog"
import { MoreHorizontal, Trash2, TargetIcon, Plus, Loader2, Play } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { targetsAPI, scansAPI } from "@/lib/api"
import { formatToBucharestTime } from "@/lib/timezone"

export default function TargetsPage() {
  const router = useRouter()
  const [targets, setTargets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isStartScanModalOpen, setIsStartScanModalOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<any>(null)
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fetch targets data
  useEffect(() => {
    async function fetchTargets() {
      try {
        setIsLoading(true)
        const data = await targetsAPI.getTargets()
        setTargets(data)
      } catch (error) {
        console.error("Error fetching targets:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load targets. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchTargets()
  }, [])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTargets = targets.slice(startIndex, endIndex)
  const totalPages = Math.ceil(targets.length / itemsPerPage)

  const handleTargetClick = (target: any) => {
    router.push(`/targets/${target.uuid}`)
  }

  const handleDeleteTarget = (target: any) => {
    setSelectedTarget(target)
    setIsDeleteDialogOpen(true)
  }

  const handleScanNow = (target: any) => {
    setSelectedTarget(target)
    setIsStartScanModalOpen(true)
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTargets([])
      setIsAllSelected(false)
    } else {
      setSelectedTargets(targets.map((target) => target.uuid))
      setIsAllSelected(true)
    }
  }

  const handleSelectTarget = (targetUuid: string) => {
    setSelectedTargets((prev) => {
      const newSelected = prev.includes(targetUuid) ? prev.filter((id) => id !== targetUuid) : [...prev, targetUuid]

      setIsAllSelected(newSelected.length === targets.length)
      return newSelected
    })
  }

  const handleBulkDelete = () => {
    if (selectedTargets.length === 0) return
    setIsBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      await targetsAPI.bulkDeleteTargets(selectedTargets)
      setTargets(targets.filter((target) => !selectedTargets.includes(target.uuid)))
      setSelectedTargets([])
      setIsAllSelected(false)

      toast({
        variant: "success",
        title: "Targets deleted",
        description: `${selectedTargets.length} target(s) have been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting targets:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete targets. Please try again.",
      })
    } finally {
      setIsBulkDeleteDialogOpen(false)
    }
  }

  const confirmDeleteTarget = async () => {
    try {
      await targetsAPI.deleteTarget(selectedTarget.uuid)
      setTargets(targets.filter((target) => target.uuid !== selectedTarget.uuid))
      toast({
        variant: "success",
        title: "Target deleted",
        description: `Target ${selectedTarget.name} has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting target:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete target. Please try again.",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const handleAddTarget = async (data: any) => {
    try {
      const newTarget = await targetsAPI.createTarget(data)
      setTargets([...targets, newTarget])
      router.refresh()
      toast({
        variant: "success",
        title: "Target added",
        description: `Target ${data.name} has been added.`,
      })
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error("Error adding target:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add target. Please try again.",
      })
    }
  }

  const handleStartScan = async (values: any) => {
    try {
      // Pre-fill the targets field with the selected target
      const scanData = {
        ...values,
        targets: selectedTarget.name,
      }

      // Parse targets from comma-separated string to array
      const targets = scanData.targets
        .split(/[,\n]/)
        .map((t: string) => t.trim())
        .filter(Boolean)

      // Format scan type and options (same logic as in scans page)
      const payload = {
        targets,
        type: scanData.scanType,
        scan_options: formatScanOptions(scanData),
      }

      const data = await scansAPI.startScan(payload)

      toast({
        title: "Scan started",
        description: `Scan for ${selectedTarget.name} has been started successfully.`,
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
      setIsStartScanModalOpen(false)
    }
  }

  // Format scan options (same as in scans page)
  const formatScanOptions = (values: any) => {
    const scanOptions: any = {}

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
      scanOptions.tcp_syn_scan = true
    }

    if (values.hostDiscoveryProbes) {
      scanOptions.echo_request = values.hostDiscoveryProbes.includes("echo")
      scanOptions.timestamp_request = values.hostDiscoveryProbes.includes("timestamp")
      scanOptions.address_mask_request = values.hostDiscoveryProbes.includes("netmask")
    }

    if (values.options) {
      scanOptions.os_detection = values.options.includes("os-detection")
      scanOptions.service_version = values.options.includes("version-detection")
      scanOptions.ssl_scan = values.options.includes("ssl-scan")
      scanOptions.http_headers = values.options.includes("http-headers")
      scanOptions.traceroute = values.options.includes("traceroute")
    }

    if (values.timing) {
      scanOptions.timing_flag = Number.parseInt(values.timing.replace("T", ""))
    } else {
      scanOptions.timing_flag = 3
    }

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

  const columns = [
    {
      key: "select",
      title: <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all" />,
      render: (row: any) => (
        <Checkbox
          checked={selectedTargets.includes(row.uuid)}
          onCheckedChange={() => handleSelectTarget(row.uuid)}
          aria-label={`Select ${row.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
    },
    {
      key: "completed_scans_count",
      title: "Scans no.",
      sortable: true,
      filterable: true,
      render: (row: any) => row.completed_scans_count || 0,
    },
    {
      key: "findings_count",
      title: "Findings no.",
      sortable: true,
      filterable: true,
      render: (row: any) => row.findings_count || 0,
    },
    {
      key: "created_at",
      title: "Date Added",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => formatToBucharestTime(row.created_at),
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
                handleScanNow(row)
              }}
            >
              <Play className="mr-2 h-4 w-4" />
              Scan Now
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteTarget(row)
              }}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Target
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
          <p className="text-muted-foreground">Loading targets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">Manage and view your scan targets</p>
        </div>
        <div className="flex items-center space-x-2">
          {selectedTargets.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedTargets.length})
            </Button>
          )}
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Target
          </Button>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <DataTable
            data={currentTargets}
            columns={columns}
            onRowClick={handleTargetClick}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <TargetIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No targets found</h3>
                <p className="text-muted-foreground mt-2 mb-6">
                  You haven't added any targets yet. Add your first target to begin scanning.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Target
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {targets.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, targets.length)} of {targets.length} targets
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
                  onClick={currentPage === 1 ? undefined : () => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
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
                  onClick={
                    currentPage === totalPages
                      ? undefined
                      : () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <DeleteTargetDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteTarget}
        target={selectedTarget}
      />

      <BulkDeleteDialog
        isOpen={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
        itemType="Target"
        itemCount={selectedTargets.length}
      />

      <AddTargetDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onConfirm={handleAddTarget} />

      <StartScanModal
        isOpen={isStartScanModalOpen}
        onClose={() => setIsStartScanModalOpen(false)}
        onSubmit={handleStartScan}
        initialTarget={selectedTarget?.name}
      />
    </div>
  )
}
