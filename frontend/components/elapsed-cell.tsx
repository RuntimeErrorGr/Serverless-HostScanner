import { formatDuration } from "@/lib/timezone"
import { formatElapsedTime } from "@/lib/timezone"
import { useState, useEffect } from "react"

interface ElapsedTimerCellProps {
  startedAt: string  // ISO timestamp
  finishedAt?: string
  status: string
}

export function ElapsedTimerCell({
  startedAt,
  finishedAt,
  status,
}: ElapsedTimerCellProps) {
  // Local state for elapsed time string
  const [display, setDisplay] = useState(() => {
    // initialize immediately
    if (["completed", "failed"].includes(status.toLowerCase())) {
      return formatDuration(startedAt, finishedAt)
    }
    return formatElapsedTime(startedAt)
  })

  useEffect(() => {
    // If scan is done, just show the final duration—no timer
    if (["completed", "failed"].includes(status.toLowerCase())) {
      setDisplay(formatDuration(startedAt, finishedAt))
      return
    }

    // Otherwise tick every second
    const interval = setInterval(() => {
      setDisplay(formatElapsedTime(startedAt))
    }, 1000)

    // Clean up on unmount or status change
    return () => clearInterval(interval)
  }, [startedAt, finishedAt, status])

  return <span>{display}</span>
}