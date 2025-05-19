import type * as React from "react"
import { cn } from "@/lib/utils"

interface ColorProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max: number
  className?: string
  indicatorClassName?: string
}

export function ColorProgressBar({ value, max, className, indicatorClassName, ...props }: ColorProgressBarProps) {
  const percentage = value / max

  // Calculate color based on progress
  const getColor = () => {
    if (percentage < 0.3) return "bg-red-500"
    if (percentage < 0.7) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)} {...props}>
      <div
        className={cn("h-full transition-all", getColor(), indicatorClassName)}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  )
}
