"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

export default function ScansPage() {
  const router = useRouter()
  const [isStartScanModalOpen, setIsStartScanModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [selectedScan, setSelectedScan] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

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
      title: "Scan deleted",
      description: `Scan ${selectedScan.name} has been deleted.`,
    })
    setIsDeleteDialogOpen(false)
  }

  const confirmGenerateReport = (format: string) => {
    // API call would go here
    toast({
      title: "Report generated",
      description: `${format.toUpperCase()} report for ${selectedScan.name} has been generated.`,
    })
    setIsReportDialogOpen(false)
    router.push("/reports")
  }

  const handleStartScan = (data: any) => {
    // API call would go here
    toast({
      title: "Scan started",
      description: "Your scan has been started successfully.",
    })
    setIsStartScanModalOpen(false)
    // Redirect to running scan page
    router.push(`/scans/new-scan-id/running`)
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Manage and view your network scans</p>
        </div>
        <Button onClick={() => setIsStartScanModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Start New Scan
        </Button>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          {scans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentScans.map((scan) => (
                  <TableRow key={scan.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => handleScanClick(scan)}>{scan.name}</TableCell>
                    <TableCell onClick={() => handleScanClick(scan)}>{scan.targets}</TableCell>
                    <TableCell onClick={() => handleScanClick(scan)}>
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
                    <TableCell onClick={() => handleScanClick(scan)}>
                      {new Date(scan.startTime).toLocaleString()}
                    </TableCell>
                    <TableCell onClick={() => handleScanClick(scan)}>
                      {scan.status === "completed" || scan.status === "failed"
                        ? new Date(scan.endTime).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleGenerateReport(scan)}
                            disabled={scan.status !== "completed"}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteScan(scan)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Scan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No scans found</h3>
              <p className="text-muted-foreground mt-2 mb-6">
                You haven't run any network scans yet. Start your first scan to begin discovering network information.
              </p>
              <Button onClick={() => setIsStartScanModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Start New Scan
              </Button>
            </div>
          )}
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
