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
import { DeleteTargetDialog } from "@/components/delete-target-dialog"
import { MoreHorizontal, Trash2, TargetIcon, Plus } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Mock data for targets - can be empty for testing empty state
const mockTargets = Array.from({ length: 20 }).map((_, i) => ({
  id: `target-${i + 1}`,
  name: `target-${i + 1}`,
  type: ["hostname", "ip", "url", "range"][Math.floor(Math.random() * 4)],
  value: ["example.com", "192.168.1.1", "https://example.org", "10.0.0.1-10"][Math.floor(Math.random() * 4)],
  dateAdded: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  totalScans: Math.floor(Math.random() * 10),
}))

export default function TargetsPage() {
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // For testing empty state, uncomment the next line
  // const targets: typeof mockTargets = []
  const targets = mockTargets

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTargets = targets.slice(startIndex, endIndex)
  const totalPages = Math.ceil(targets.length / itemsPerPage)

  const handleTargetClick = (target: any) => {
    router.push(`/targets/${target.id}`)
  }

  const handleDeleteTarget = (target: any) => {
    setSelectedTarget(target)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteTarget = () => {
    // API call would go here
    toast({
      variant: "success",
      title: "Target deleted",
      description: `Target ${selectedTarget.name} has been deleted.`,
    })
    setIsDeleteDialogOpen(false)
  }

  const columns = [
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
    },
    {
      key: "type",
      title: "Type",
      sortable: true,
      filterable: true,
      render: (row: any) => <span className="capitalize">{row.type}</span>,
    },
    {
      key: "value",
      title: "Value",
      sortable: true,
      filterable: true,
    },
    {
      key: "dateAdded",
      title: "Date Added",
      sortable: true,
      filterable: true,
      filterType: "date" as const,
      render: (row: any) => new Date(row.dateAdded).toLocaleString(),
    },
    {
      key: "totalScans",
      title: "Total Scans",
      sortable: true,
      filterable: true,
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

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Targets</h1>
          <p className="text-muted-foreground">Manage and view your scan targets</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Target
        </Button>
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
                <Button>
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

      <DeleteTargetDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteTarget}
        target={selectedTarget}
      />
    </div>
  )
}
