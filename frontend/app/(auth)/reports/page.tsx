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
import { DeleteReportDialog } from "@/components/delete-report-dialog"
import { MoreHorizontal, Trash2, Download, FileText } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Mock data for reports - can be empty for testing empty state
const mockReports = Array.from({ length: 20 }).map((_, i) => ({
  id: `report-${i + 1}`,
  scanId: `scan-${Math.floor(Math.random() * 10) + 1}`,
  scanName: `Scan ${Math.floor(Math.random() * 10) + 1}`,
  format: ["json", "csv", "pdf"][Math.floor(Math.random() * 3)],
  dateGenerated: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  lastDownloaded: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 1000000000).toISOString() : null,
}))

export default function ReportsPage() {
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // For testing empty state, uncomment the next line
  // const reports: typeof mockReports = []
  const reports = mockReports

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReports = reports.slice(startIndex, endIndex)
  const totalPages = Math.ceil(reports.length / itemsPerPage)

  const handleScanClick = (report: any) => {
    router.push(`/scans/${report.scanId}`)
  }

  const handleDeleteReport = (report: any) => {
    setSelectedReport(report)
    setIsDeleteDialogOpen(true)
  }

  const handleDownloadReport = (report: any) => {
    // In a real app, this would trigger a download
    toast({
      variant: "success",
      title: "Report downloaded",
      description: `${report.format.toUpperCase()} report for ${report.scanName} has been downloaded.`,
    })
  }

  const confirmDeleteReport = () => {
    // API call would go here
    toast({
      variant: "success",
      title: "Report deleted",
      description: `Report for ${selectedReport.scanName} has been deleted.`,
    })
    setIsDeleteDialogOpen(false)
  }

  const columns = [
    {
      key: "scanName",
      title: "Scan",
      sortable: true,
      filterable: true,
    },
    {
      key: "format",
      title: "Format",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <Badge variant="outline" className="uppercase">
          {row.format}
        </Badge>
      ),
    },
    {
      key: "dateGenerated",
      title: "Date Generated",
      sortable: true,
      filterable: true,
      render: (row: any) => new Date(row.dateGenerated).toLocaleString(),
    },
    {
      key: "lastDownloaded",
      title: "Last Downloaded",
      sortable: true,
      filterable: true,
      render: (row: any) => (row.lastDownloaded ? new Date(row.lastDownloaded).toLocaleString() : "Never"),
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

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Manage and download your scan reports</p>
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

      <DeleteReportDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteReport}
        report={selectedReport}
      />
    </div>
  )
}
