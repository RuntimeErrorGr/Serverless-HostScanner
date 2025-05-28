"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Target, CheckCircle, XCircle } from "lucide-react"
import { getParameterDocumentation, formatParameterKey, getParameterValue } from "@/lib/nmap-docs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ParameterSectionProps {
  parameters: Record<string, any>
  targets?: string[]
}

function isParameterEnabled(value: any): boolean {
  if (typeof value === "boolean") {
    return value
  }
  return true // Non-boolean values are considered "enabled" if they exist
}

export function ParameterSection({ parameters, targets }: ParameterSectionProps) {
  const [targetsExpanded, setTargetsExpanded] = useState(true)
  const [enabledExpanded, setEnabledExpanded] = useState(true)
  const [disabledExpanded, setDisabledExpanded] = useState(false)

  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <p>No parameters available</p>
      </div>
    )
  }

  // Separate enabled and disabled parameters
  const paramEntries = Object.entries(parameters)
  const enabledParams = paramEntries.filter(([key, value]) => isParameterEnabled(value))
  const disabledParams = paramEntries.filter(([key, value]) => !isParameterEnabled(value))

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Parameter</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets && targets.length > 0 && (
              <>
                <TableRow className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <TableCell colSpan={4} className="py-2">
                    <button
                      onClick={() => setTargetsExpanded(!targetsExpanded)}
                      className="flex items-center w-full text-left font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      {targetsExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      <Target className="h-4 w-4 mr-2" />
                      Scan Targets ({targets.length})
                    </button>
                  </TableCell>
                </TableRow>

                {targetsExpanded &&
                  targets.map((target, index) => (
                    <TableRow key={`target-${index}`} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                      <TableCell className="font-mono text-sm">{target}</TableCell>
                      <TableCell>
                        <CheckCircle className="h-4 w-4 mr-2" />
                      </TableCell>
                      <TableCell className="text-sm text-white">
                        Network target for scanning operations
                      </TableCell>
                    </TableRow>
                  ))}
              </>
            )}

            {/* Enabled Parameters Section */}
            {enabledParams.length > 0 && (
              <>
                <TableRow className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <TableCell colSpan={4} className="py-2">
                    <button
                      onClick={() => setEnabledExpanded(!enabledExpanded)}
                      className="flex items-center w-full text-left font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                    >
                      {enabledExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Enabled Parameters ({enabledParams.length})
                    </button>
                  </TableCell>
                </TableRow>

                {enabledExpanded &&
                  enabledParams.map(([key, value]) => {
                    const documentation = getParameterDocumentation(key)
                    const displayName = formatParameterKey(key)
                    const displayValue = getParameterValue(key, value)

                    return (
                      <TableRow key={key} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div>{displayName}</div>
                            {documentation && (
                              <Badge variant="outline" className="text-xs">
                                {documentation.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {displayValue ? (
                            <span className="text-sm">{displayValue}</span>
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <p className="text-sm">{documentation?.description || "No description available"}</p>
                            {documentation && (
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>
                                  <span className="font-medium">Scan Time:</span> {documentation.scanTime}
                                </span>
                                <span>
                                  <span className="font-medium">Precision:</span> {documentation.precision}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </>
            )}

            {/* Disabled Parameters Section */}
            {disabledParams.length > 0 && (
              <>
                <TableRow className="bg-muted/30 border-muted">
                  <TableCell colSpan={4} className="py-2">
                    <button
                      onClick={() => setDisabledExpanded(!disabledExpanded)}
                      className="flex items-center w-full text-left font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {disabledExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      <XCircle className="h-4 w-4 mr-2" />
                      Disabled Parameters ({disabledParams.length})
                    </button>
                  </TableCell>
                </TableRow>

                {disabledExpanded &&
                  disabledParams.map(([key, value]) => {
                    const documentation = getParameterDocumentation(key)
                    const displayName = formatParameterKey(key)

                    return (
                      <TableRow key={key} className="opacity-60 hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div className="text-muted-foreground">{displayName}</div>
                            {documentation && (
                              <Badge variant="outline" className="text-xs opacity-50">
                                {documentation.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">
                            {documentation?.description || "No description available"}
                          </p>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
