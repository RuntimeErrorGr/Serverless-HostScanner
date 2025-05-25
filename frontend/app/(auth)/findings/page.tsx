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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MoreHorizontal, Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { findingsAPI } from "@/lib/api"

export default function FindingsPage() {
  const router = useRouter()
  const [findings, setFindings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fetch findings data
  useEffect(() => {
    async function fetchFindings() {
      try {
        setIsLoading(true)
        const data = await findingsAPI.getFindings()
        setFindings(data)
      } catch (error) {
        console.error("Error fetching findings:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load findings. Please try again.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchFindings()
  }, [])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFindings = findings.slice(startIndex, endIndex)
  const totalPages = Math.ceil(findings.length / itemsPerPage)

  const handleFindingClick = (finding: any) => {
    router.push(`/findings/${finding.id}`)
  }

  const handleDeleteFinding = (finding: any) => {
    setSelectedFinding(finding)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteFinding = async () => {
    try {
      await findingsAPI.deleteFinding(selectedFinding.id)
      setFindings(findings.filter((finding) => finding.id !== selectedFinding.id))
      toast({
        variant: "success",
        title: "Finding deleted",
        description: `Finding has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting finding:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete finding. Please try again.",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "bg-red-500 hover:bg-red-600"
      case "high":
        return "bg-orange-500 hover:bg-orange-600"
      case "medium":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "low":
        return "bg-blue-500 hover:bg-blue-600"
      case "info":
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  const columns = [
    {
      key: "name",
      title: "Finding",
      sortable: true,
      filterable: true,
    },
    {
      key: "port",
      title: "Port",
      sortable: true,
      filterable: true,
      render: (row: any) => (row.port ? `${row.port}/${row.protocol}` : "-"),
    },
    {
      key: "service",
      title: "Service",
      sortable: true,
      filterable: true,
    },
    {
      key: "severity",
      title: "Severity",
      sortable: true,
      filterable: true,
      render: (row: any) => (
        <Badge className={getSeverityColor(row.severity)}>{row.severity?.toUpperCase() || "UNKNOWN"}</Badge>
      ),
    },
    {
      key: "created_at",
      title: "Date Found",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => new Date(row.created_at).toLocaleString(),
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
                handleDeleteFinding(row)
              }}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Finding
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
          <p className="text-muted-foreground">Loading findings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Findings</h1>
        <p className="text-muted-foreground">Security findings and vulnerabilities discovered during scans</p>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <DataTable
            data={currentFindings}
            columns={columns}
            onRowClick={handleFindingClick}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No findings found</h3>
                <p className="text-muted-foreground mt-2 mb-6">
                  No security findings or vulnerabilities have been discovered yet. Run scans to detect potential
                  issues.
                </p>
                <Button onClick={() => router.push("/scans")}>Go to Scans</Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {findings.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, findings.length)} of {findings.length} findings
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this finding. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFinding} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
