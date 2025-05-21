"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataTableColumn<T> {
  key: string
  title: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  onRowClick?: (row: T) => void
  className?: string
  emptyState?: React.ReactNode
}

export function DataTable<T>({ data, columns, onRowClick, className, emptyState }: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [filteredData, setFilteredData] = useState<T[]>(data)
  const [showFilters, setShowFilters] = useState(false)
  const [enableSorting, setEnableSorting] = useState(true)

  // Update filtered data when data, filters, or sort config changes
  useEffect(() => {
    let result = [...data]

    // Apply filters
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        result = result.filter((item) => {
          const value = (item as any)[key]
          if (value === undefined || value === null) return false
          return String(value).toLowerCase().includes(filters[key].toLowerCase())
        })
      }
    })

    // Apply sorting
    if (sortConfig !== null && enableSorting) {
      result.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key]
        const bValue = (b as any)[sortConfig.key]

        if (aValue === undefined || aValue === null) return sortConfig.direction === "asc" ? -1 : 1
        if (bValue === undefined || bValue === null) return sortConfig.direction === "asc" ? 1 : -1

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        }

        return sortConfig.direction === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1
      })
    }

    setFilteredData(result)
  }, [data, filters, sortConfig, enableSorting])

  const requestSort = (key: string) => {
    if (!enableSorting) return

    let direction: "asc" | "desc" = "asc"

    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc"
      } else {
        // If already desc, remove sorting
        setSortConfig(null)
        return
      }
    }

    setSortConfig({ key, direction })
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  const toggleFiltersAndSorting = () => {
    if (showFilters) {
      setShowFilters(false)
      setEnableSorting(true)
    } else {
      setShowFilters(true)
    }
  }

  const toggleSorting = () => {
    setEnableSorting(!enableSorting)
    if (!enableSorting) {
      setSortConfig(null)
    }
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFiltersAndSorting}
            className={cn(showFilters && "bg-secondary")}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>

          {showFilters && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSorting}
                className={cn(!enableSorting && "bg-secondary")}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {enableSorting ? "Disable Sorting" : "Enable Sorting"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={Object.values(filters).every((v) => !v)}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={cn("rounded-md border", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.sortable && enableSorting && "cursor-pointer select-none",
                    showFilters && "pt-0",
                  )}
                  onClick={() => (column.sortable ? requestSort(column.key) : undefined)}
                >
                  <div className="py-2">
                    <div className="flex items-center">
                      {column.title}
                      {column.sortable && enableSorting && getSortIcon(column.key)}
                    </div>

                    {showFilters && column.filterable && (
                      <div className="mt-2">
                        <Input
                          placeholder={`Filter ${column.title}`}
                          value={filters[column.key] || ""}
                          onChange={(e) => handleFilterChange(column.key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column) => (
                    <TableCell key={`${rowIndex}-${column.key}`}>
                      {column.render
                        ? column.render(row)
                        : (row as any)[column.key] !== undefined
                          ? String((row as any)[column.key])
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyState || "No results found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
