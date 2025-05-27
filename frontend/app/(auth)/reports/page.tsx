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
import { DeleteReportDialog } from "@/components/delete-report-dialog"
import { BulkDeleteDialog } from "@/components/bulk-delete-dialog"
import { MoreHorizontal, Trash2, Download, FileText, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { reportsAPI } from "@/lib/api"
import { formatToBucharestTime } from "@/lib/timezone"
import { Checkbox } from "@/components/ui/checkbox"

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  // Fetch reports data
  useEffect(() => {
    async function fetchReports() {
      try {
        setIsLoading(true)
        const data = await reportsAPI.getReports()
        setReports(data)
      } catch (error) {
        console.error("Error fetching reports:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load reports. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchReports()
  }, [])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReports = reports.slice(startIndex, endIndex)
  const totalPages = Math.ceil(reports.length / itemsPerPage)

  const handleScanClick = (report: any) => {
    router.push(`/scans/${report.scan_uuid}`)
  }

  const handleDeleteReport = (report: any) => {
    setSelectedReport(report)
    setIsDeleteDialogOpen(true)
  }

  const handleDownloadReport = async (report: any) => {
    try {
      const response = await reportsAPI.downloadReport(report.uuid)

      if (response.ok) {
        // Create blob from response
        const blob = await response.blob()

        // Create download link
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = report.name || `report-${report.uuid}.${report.type.toLowerCase()}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          variant: "success",
          title: "Report downloaded",
          description: `${report.type} report has been downloaded.`,
        })
      } else {
        throw new Error("Download failed")
      }
    } catch (error) {
      console.error("Error downloading report:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download report. Please try again.",
      })
    }
  }

  const confirmDeleteReport = async () => {
    try {
      await reportsAPI.deleteReport(selectedReport.uuid)
      setReports(reports.filter((report) => report.uuid !== selectedReport.uuid))
      toast({
        variant: "success",
        title: "Report deleted",
        description: `Report has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting report:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete report. Please try again.",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedReports([])
      setIsAllSelected(false)
    } else {
      setSelectedReports(reports.map((report) => report.uuid))
      setIsAllSelected(true)
    }
  }

  const handleSelectReport = (reportUuid: string) => {
    setSelectedReports((prev) => {
      const newSelected = prev.includes(reportUuid) ? prev.filter((id) => id !== reportUuid) : [...prev, reportUuid]

      setIsAllSelected(newSelected.length === reports.length)
      return newSelected
    })
  }

  const handleBulkDelete = () => {
    if (selectedReports.length === 0) return
    setIsBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      await reportsAPI.bulkDeleteReports(selectedReports)
      setReports(reports.filter((report) => !selectedReports.includes(report.uuid)))
      setSelectedReports([])
      setIsAllSelected(false)

      toast({
        variant: "success",
        title: "Reports deleted",
        description: `${selectedReports.length} report(s) have been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting reports:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete reports. Please try again.",
      })
    } finally {
      setIsBulkDeleteDialogOpen(false)
    }
  }

  const columns = [
    {
      key: "select",
      title: <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all" />,
      render: (row: any) => (
        <Checkbox
          checked={selectedReports.includes(row.uuid)}
          onCheckedChange={() => handleSelectReport(row.uuid)}
          aria-label={`Select ${row.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "name",
      title: "Report Name",
      sortable: true,
      filterable: true,
    },
    {
      key: "type",
      title: "Format",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <Badge variant="outline" className="uppercase">
          {row.type}
        </Badge>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <Badge
          variant={row.status === "GENERATED" ? "default" : row.status === "PENDING" ? "secondary" : "destructive"}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "created_at",
      title: "Date Generated",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => formatToBucharestTime(row.created_at),
    },
    {
      key: "last_downloaded_at",
      title: "Last Downloaded",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => (row.last_downloaded_at ? formatToBucharestTime(row.last_downloaded_at) : "Never"),
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
                handleDownloadReport(row)
              }}
              disabled={row.status !== "GENERATED"}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteReport(row)
              }}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Report
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
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Manage and download your scan reports</p>
        </div>
        {selectedReports.length > 0 && (
          <Button variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedReports.length})
          </Button>
        )}
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <DataTable
            data={currentReports}
            columns={columns}
            onRowClick={handleScanClick}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No reports found</h3>
                <p className="text-muted-foreground mt-2 mb-6">
                  You haven't generated any reports yet. Complete a scan and generate a report to see it here.
                </p>
                <Button onClick={() => router.push("/scans")}>Go to Scans</Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {reports.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, reports.length)} of {reports.length} reports
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

      <DeleteReportDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteReport}
        report={selectedReport}
      />

      <BulkDeleteDialog
        isOpen={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
        itemType="Report"
        itemCount={selectedReports.length}
      />
    </div>
  )
}
