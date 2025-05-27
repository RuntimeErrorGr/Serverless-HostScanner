// Timezone utility for consistent frontend date handling
import type React from "react" // Import React for JSX usage
export const BUCHAREST_TZ = "Europe/Bucharest"

/**
 * Parse a date string or Date object and ensure it's properly timezone aware
 */
function parseDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null

  let date: Date

  if (typeof dateInput === "string") {
    // If the string doesn't have timezone info, assume it's UTC
    if (
      !dateInput.includes("T") ||
      (!dateInput.includes("+") && !dateInput.includes("Z") && !dateInput.endsWith("+00:00"))
    ) {
      // Add 'Z' to indicate UTC if no timezone info is present
      const isoString = dateInput.includes("T") ? dateInput + "Z" : dateInput + "T00:00:00Z"
      date = new Date(isoString)
    } else {
      date = new Date(dateInput)
    }
  } else {
    date = dateInput
  }

  return isNaN(date.getTime()) ? null : date
}

/**
 * Format a date string or Date object to Bucharest timezone with custom styling
 * Returns JSX element with date and time formatted separately
 */
export function formatToBucharestTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): React.ReactElement {
  // Use React.ReactElement instead of JSX.Element
  const date = parseDate(dateInput)
  if (!date) return <span>-</span>

  // Format date part
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUCHAREST_TZ,
    ...options,
  }

  // Format time part with 12-hour format
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: BUCHAREST_TZ,
  }

  const dateStr = date.toLocaleDateString("en-GB", dateOptions)
  const timeStr = date.toLocaleTimeString("en-US", timeOptions)

  return (
    <div className="flex flex-col">
      <span className="text-sm">{dateStr}</span>
      <span className="text-xs text-muted-foreground">{timeStr}</span>
    </div>
  )
}

export function formatToBucharestTimeSingleLine(dateInput: string | Date | null | undefined): string {
  const date = parseDate(dateInput)
  if (!date) return "-"
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUCHAREST_TZ,
  }

  // Format time part with 12-hour format
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: BUCHAREST_TZ,
  }

  const dateStr = date.toLocaleDateString("en-GB", dateOptions)
  const timeStr = date.toLocaleTimeString("en-US", timeOptions)
  
  return `${dateStr} ${timeStr}`
}

/**
 * Format a date to just the date part (no time) in Bucharest timezone
 */
export function formatToBucharestDate(dateInput: string | Date | null | undefined): string {
  const date = parseDate(dateInput)
  if (!date) return "-"

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUCHAREST_TZ,
  })
}

/**
 * Format a date to just the time part in Bucharest timezone with AM/PM
 */
export function formatToBucharestTimeOnly(dateInput: string | Date | null | undefined): string {
  const date = parseDate(dateInput)
  if (!date) return "-"

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: BUCHAREST_TZ,
  })
}

/**
 * Get the current time in Bucharest timezone
 */
export function nowInBucharest(): React.ReactElement {
  // Use React.ReactElement instead of JSX.Element
  return formatToBucharestTime(new Date())
}

/**
 * Get current time as Date object in Bucharest timezone
 */
export function nowInBucharestAsDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: BUCHAREST_TZ }))
}

/**
 * Calculate duration between two dates and format it nicely
 */
export function formatDuration(
  startTime: string | Date | null | undefined,
  endTime: string | Date | null | undefined,
): string {
  const start = parseDate(startTime)
  const end = parseDate(endTime)

  if (!start || !end) return "N/A"

  const diffMs = end.getTime() - start.getTime()

  if (diffMs < 0) return "Invalid Duration"

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(" ")
}

/**
 * Calculate elapsed time from a start date to now
 */
export function formatElapsedTime(startTime: string | Date | null | undefined): string {
  if (!startTime) return "0s"

  // Use current time for accurate elapsed calculation
  return formatDuration(startTime, new Date())
}

/**
 * Check if a date is today in Bucharest timezone
 */
export function isToday(dateInput: string | Date | null | undefined): boolean {
  const date = parseDate(dateInput)
  if (!date) return false

  const today = new Date()

  // Convert both dates to Bucharest timezone for comparison
  const dateStr = formatToBucharestDate(date)
  const todayStr = formatToBucharestDate(today)

  return dateStr === todayStr
}

/**
 * Debug function to help troubleshoot timezone issues
 */
export function debugDateTime(dateInput: string | Date | null | undefined) {
  const parsed = parseDate(dateInput)
  console.log("Debug DateTime:", {
    original: dateInput,
    parsed: parsed,
    parsedISOString: parsed?.toISOString(),
    bucharestTime: formatToBucharestTime(dateInput),
    localTime: parsed?.toLocaleString(),
  })
}
