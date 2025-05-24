"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Port {
  port: number
  protocol: string
  service: string
  state: string
  product?: string
  version?: string
  scripts?: Record<string, string>
}

interface PortResultsTableProps {
  ports: Port[]
  onPortClick: (port: Port) => void
}

export function PortResultsTable({ ports, onPortClick }: PortResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({
    state: "open", // Default filter to show only open ports
  })
  const [filteredData, setFilteredData] = useState<Port[]>(ports)
  const [showFilters, setShowFilters] = useState(false)
  const [enableSorting, setEnableSorting] = useState(true)

  // Function to get port state badge variant and color
  const getPortStateBadge = (state: string) => {
    switch (state.toLowerCase()) {
      case "open":
        return {
          variant: "default",
          className:
            "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/30",
        }
      case "open|filtered":
        return {
          variant: "default",
          className:
            "bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 hover:bg-amber-150 dark:hover:bg-amber-950/40",
        }
      case "closed":
        return {
          variant: "default",
          className:
            "bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 hover:bg-red-150 dark:hover:bg-red-950/40",
        }
      case "filtered":
      case "unknown":
      default:
        return { variant: "secondary", className: "" }
    }
  }

  // Add this helper function after the existing helper functions
  const getPortStats = () => {
    const totalPorts = ports.length
    const filteredPorts = filteredData.length
    const hiddenPorts = totalPorts - filteredPorts

    // Count ports by state
    const stateCounts = ports.reduce(
      (acc, port) => {
        acc[port.state] = (acc[port.state] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const hasActiveFilters = Object.values(filters).some((v) => v)

    return {
      totalPorts,
      filteredPorts,
      hiddenPorts,
      stateCounts,
      hasActiveFilters,
    }
  }

  // Update filtered data when ports, filters, or sort config changes
  useEffect(() => {
    let result = [...ports]

    // Apply filters
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        result = result.filter((port) => {
          const value = (port as any)[key]
          if (value === undefined || value === null) return false

          // For state filtering, use exact match
          if (key === "state") {
            return String(value).toLowerCase() === filters[key].toLowerCase()
          }

          // For other fields, use includes (partial match)
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
  }, [ports, filters, sortConfig, enableSorting])

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

  const columns = [
    { key: "port", title: "Port", sortable: true, filterable: true },
    { key: "service", title: "Service", sortable: true, filterable: true },
    { key: "product", title: "Product", sortable: true, filterable: true },
    { key: "state", title: "State", sortable: true, filterable: true },
    { key: "scripts", title: "Scripts", sortable: false, filterable: false },
  ]

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

          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!getPortStats().hasActiveFilters}
            className={cn(getPortStats().hasActiveFilters && "border-orange-200 dark:border-orange-800")}
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>

          {showFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSorting}
              className={cn(!enableSorting && "bg-secondary")}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {enableSorting ? "Disable Sorting" : "Enable Sorting"}
            </Button>
          )}
        </div>
      </div>

      {/* Port Statistics */}
      <div className="text-sm text-muted-foreground">
        {(() => {
          const stats = getPortStats()

          if (!stats.hasActiveFilters) {
            // No filters active - show total breakdown
            const stateEntries = Object.entries(stats.stateCounts).sort(([, a], [, b]) => b - a)
            return (
              <span>
                Showing all {stats.totalPorts} ports:{" "}
                {stateEntries.map(([state, count], index) => (
                  <span key={state}>
                    <span
                      className={cn(
                        "font-medium",
                        state === "open" && "text-green-600 dark:text-green-400",
                        state === "closed" && "text-red-600 dark:text-red-400",
                        state === "filtered" && "text-gray-600 dark:text-gray-400",
                        state === "open|filtered" && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {count} {state}
                    </span>
                    {index < stateEntries.length - 1 && ", "}
                  </span>
                ))}
              </span>
            )
          } else {
            // Filters active - show filtered results
            const currentStateFilter = filters.state
            if (currentStateFilter && stats.hiddenPorts > 0) {
              return (
                <span>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {stats.filteredPorts} {currentStateFilter}
                  </span>{" "}
                  ports,
                  <span className="font-medium text-foreground"> {stats.hiddenPorts} other ports</span> are hidden.
                </span>
              )
            } else if (stats.hiddenPorts > 0) {
              return (
                <span>
                  Showing <span className="font-medium text-foreground">{stats.filteredPorts}</span> of{" "}
                  <span className="font-medium text-foreground">{stats.totalPorts}</span> ports.
                </span>
              )
            } else {
              return (
                <span>
                  Showing all <span className="font-medium text-foreground">{stats.filteredPorts}</span> matching ports
                </span>
              )
            }
          }
        })()}
      </div>

      {showFilters && (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
            {columns.map((column) => (
              <div key={column.key}>
                {column.filterable && (
                  <Input
                    placeholder={`Filter ${column.title}`}
                    value={filters[column.key] || ""}
                    onChange={(e) => handleFilterChange(column.key, e.target.value)}
                    className="h-7 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.sortable && enableSorting && "cursor-pointer select-none")}
                  onClick={() => (column.sortable ? requestSort(column.key) : undefined)}
                >
                  <div className="flex items-center">
                    {column.title}
                    {column.sortable && enableSorting && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((port, portIndex) => (
                <TableRow
                  key={portIndex}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onPortClick(port)}
                >
                  <TableCell>
                    {port.port}/{port.protocol}
                  </TableCell>
                  <TableCell>{port.service}</TableCell>
                  <TableCell>
                    {port.product && port.version ? `${port.product} ${port.version}` : port.product || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getPortStateBadge(port.state).variant as any}
                      className={getPortStateBadge(port.state).className}
                    >
                      {port.state}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {port.scripts && Object.keys(port.scripts).length > 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-400"
                      >
                        {Object.keys(port.scripts).length} finding
                        {Object.keys(port.scripts).length !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No ports found matching the current filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
