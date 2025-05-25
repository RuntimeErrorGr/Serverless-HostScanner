"use client"

import { useState, useEffect } from "react"
import { formatDuration, formatElapsedTime } from "@/lib/timezone"

interface ElapsedTimerCellProps {
  startedAt: string | null
  finishedAt: string | null
  status: string
}

export function ElapsedTimerCell({ startedAt, finishedAt, status }: ElapsedTimerCellProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("")

  useEffect(() => {
    // If scan is completed or failed, show the final duration
    if ((status.toLowerCase() === "completed" || status.toLowerCase() === "failed") && startedAt && finishedAt) {
      setElapsedTime(formatDuration(startedAt, finishedAt))
      return
    }

    // If scan is running and has started, show real-time elapsed time
    if (status.toLowerCase() === "running" && startedAt) {
      const updateElapsed = () => {
        setElapsedTime(formatElapsedTime(startedAt))
      }

      // Update immediately
      updateElapsed()

      // Update every second
      const interval = setInterval(updateElapsed, 1000)

      return () => clearInterval(interval)
    }

    // For pending scans or scans without start time
    setElapsedTime("-")
  }, [startedAt, finishedAt, status])

  return <span className="text-sm">{elapsedTime}</span>
}
