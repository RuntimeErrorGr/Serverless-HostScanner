"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface DataTableColumn<T> {
  key: string
  title: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
  filterType?: "text" | "date"
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
  const [dateFilters, setDateFilters] = useState<Record<string, { date: Date | undefined; time: string }>>({})
  const [filteredData, setFilteredData] = useState<T[]>(data)
  const [showFilters, setShowFilters] = useState(false)
  const [enableSorting, setEnableSorting] = useState(true)

  // Update filtered data when data, filters, or sort config changes
  useEffect(() => {
    let result = [...data]

    // Apply text filters
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        result = result.filter((item) => {
          const value = (item as any)[key]
          if (value === undefined || value === null) return false
          return String(value).toLowerCase().includes(filters[key].toLowerCase())
        })
      }
    })

    // Apply date filters
    Object.keys(dateFilters).forEach((key) => {
      const dateFilter = dateFilters[key]
      if (dateFilter.date) {
        result = result.filter((item) => {
          const value = (item as any)[key]
          if (value === undefined || value === null) return false

          const itemDate = new Date(value)
          const filterDate = new Date(dateFilter.date!)

          // If time is specified, match exact date and time (without seconds)
          if (dateFilter.time) {
            const [hours, minutes] = dateFilter.time.split(":").map(Number)
            filterDate.setHours(hours, minutes, 0, 0)

            // For exact date-time matching, check if both date and time match (ignoring seconds)
            return (
              itemDate.getFullYear() === filterDate.getFullYear() &&
              itemDate.getMonth() === filterDate.getMonth() &&
              itemDate.getDate() === filterDate.getDate() &&
              itemDate.getHours() === filterDate.getHours() &&
              itemDate.getMinutes() === filterDate.getMinutes()
            )
          } else {
            // For date-only filtering, check if it's the exact same date (ignore time)
            return (
              itemDate.getFullYear() === filterDate.getFullYear() &&
              itemDate.getMonth() === filterDate.getMonth() &&
              itemDate.getDate() === filterDate.getDate()
            )
          }
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
  }, [data, filters, dateFilters, sortConfig, enableSorting])

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

  const handleDateFilterChange = (key: string, date: Date | undefined, time?: string) => {
    setDateFilters((prev) => ({
      ...prev,
      [key]: {
        date,
        time: time || prev[key]?.time || "",
      },
    }))
  }

  const clearFilters = () => {
    setFilters({})
    setDateFilters({})
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

  const hasActiveFilters = Object.values(filters).some((v) => v) || Object.values(dateFilters).some((v) => v.date)

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

              <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
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
                    showFilters && "pb-0",
                  )}
                  onClick={() => (column.sortable ? requestSort(column.key) : undefined)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center py-2">
                      {column.title}
                      {column.sortable && enableSorting && getSortIcon(column.key)}
                    </div>

                    {showFilters && column.filterable && (
                      <div className="pb-2" onClick={(e) => e.stopPropagation()}>
                        {column.filterType === "date" ? (
                          <div className="flex items-center space-x-1">
                            <div className="flex-[2]">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "w-full justify-start text-left font-normal h-7 text-xs",
                                      !dateFilters[column.key]?.date && "text-muted-foreground",
                                    )}
                                  >
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {dateFilters[column.key]?.date
                                      ? format(dateFilters[column.key].date!, "MMM dd")
                                      : "Date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={dateFilters[column.key]?.date}
                                    onSelect={(date) => handleDateFilterChange(column.key, date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="flex-1">
                              <Input
                                type="time"
                                value={dateFilters[column.key]?.time || ""}
                                onChange={(e) =>
                                  handleDateFilterChange(column.key, dateFilters[column.key]?.date, e.target.value)
                                }
                                className="h-7 text-xs"
                                placeholder="HH:MM"
                                step="60"
                              />
                            </div>
                          </div>
                        ) : (
                          <Input
                            placeholder={`Filter ${column.title}`}
                            value={filters[column.key] || ""}
                            onChange={(e) => handleFilterChange(column.key, e.target.value)}
                            className="h-7 text-xs"
                          />
                        )}
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
