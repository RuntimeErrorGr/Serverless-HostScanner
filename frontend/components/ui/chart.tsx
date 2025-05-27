"use client"

import type React from "react"
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"

interface ChartProps {
  data: any[]
  index: string
  categories: string[]
  colors: string[]
  valueFormatter?: (value: number) => string
  className?: string
}

export const LineChart: React.FC<ChartProps> = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => value.toString(),
  className,
}) => {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={index} className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
          <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: any) => [valueFormatter(value), ""]}
            labelClassName="text-sm font-medium"
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          {categories.map((category, index) => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              stroke={colors[index] || colors[0]}
              strokeWidth={2}
              dot={{ fill: colors[index] || colors[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: colors[index] || colors[0], strokeWidth: 2 }}
            />
          ))}
          {categories.length > 1 && <Legend />}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

export const PieChart: React.FC<ChartProps> = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => value.toString(),
  className,
}) => {
  // For pie charts, we use the color property from data if available, otherwise use the colors array
  const chartData = data.map((item, idx) => ({
    ...item,
    fill: item.color || colors[idx % colors.length],
  }))

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={categories[0]}
            nameKey={index}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => [valueFormatter(value), ""]}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

export const BarChart: React.FC<ChartProps> = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => value.toString(),
  className,
}) => {
  return (
    <div className={className}>
      {/* Mock BarChart implementation - can be implemented similarly with Recharts */}
      <div className="flex items-center justify-center h-full text-muted-foreground">
        BarChart: {data.length} data points
      </div>
    </div>
  )
}
