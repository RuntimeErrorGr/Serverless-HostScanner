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
import { DeleteTargetDialog } from "@/components/delete-target-dialog"
import { MoreHorizontal, Trash2, Target, Plus } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

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
      title: "Target deleted",
      description: `Target ${selectedTarget.name} has been deleted.`,
    })
    setIsDeleteDialogOpen(false)
  }

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
          {targets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Total Scans</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTargets.map((target) => (
                  <TableRow key={target.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => handleTargetClick(target)}>{target.name}</TableCell>
                    <TableCell onClick={() => handleTargetClick(target)}>
                      <span className="capitalize">{target.type}</span>
                    </TableCell>
                    <TableCell onClick={() => handleTargetClick(target)}>{target.value}</TableCell>
                    <TableCell onClick={() => handleTargetClick(target)}>
                      {new Date(target.dateAdded).toLocaleString()}
                    </TableCell>
                    <TableCell onClick={() => handleTargetClick(target)}>{target.totalScans}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDeleteTarget(target)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Target
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
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No targets found</h3>
              <p className="text-muted-foreground mt-2 mb-6">
                You haven't added any targets yet. Add your first target to begin scanning.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Target
              </Button>
            </div>
          )}
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
