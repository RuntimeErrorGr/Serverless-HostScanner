// components/ui/chart.tsx
import type React from "react"

interface ChartProps {
  data: any[]
  index: string
  categories: string[]
  colors: string[]
  valueFormatter?: (value: number) => string
  className?: string
}

export const BarChart: React.FC<ChartProps> = ({ data, index, categories, colors, valueFormatter, className }) => {
  return (
    <div className={className}>
      {/* Mock BarChart implementation */}
      <div>BarChart: {data.length} data points</div>
    </div>
  )
}

export const LineChart: React.FC<ChartProps> = ({ data, index, categories, colors, valueFormatter, className }) => {
  return (
    <div className={className}>
      {/* Mock LineChart implementation */}
      <div>LineChart: {data.length} data points</div>
    </div>
  )
}

export const PieChart: React.FC<ChartProps> = ({ data, index, categories, colors, valueFormatter, className }) => {
  return (
    <div className={className}>
      {/* Mock PieChart implementation */}
      <div>PieChart: {data.length} data points</div>
    </div>
  )
}
