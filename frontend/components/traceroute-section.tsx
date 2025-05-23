"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Route } from "lucide-react"

interface TracerouteHop {
  ttl: string;
  ipaddr: string;
  rtt: string;
  host: string;
}

interface TracerouteSectionProps {
  traceroute: TracerouteHop[];
}

export function TracerouteSection({ traceroute }: TracerouteSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!traceroute || traceroute.length === 0) {
    return null
  }
  
  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 mr-1" />
        ) : (
          <ChevronRight className="h-4 w-4 mr-1" />
        )}
        <Route className="h-4 w-4 mr-1" />
        <span>Traceroute ({traceroute.length} hops)</span>
      </button>
      
      {isExpanded && (
        <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md">
          <div className="font-mono text-xs space-y-1">
            {traceroute.map((hop, hopIndex) => (
              <div key={hopIndex}>
                {hop.ttl}. {hop.ipaddr} ({hop.rtt}ms) {hop.host && `(${hop.host})`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 