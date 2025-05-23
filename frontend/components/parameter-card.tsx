"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Clock, Target, Shield, Info } from "lucide-react"
import { getParameterDocumentation, formatParameterKey, getParameterValue } from "@/lib/nmap-docs"

interface ParameterCardProps {
  paramKey: string;
  value: any;
  isEnabled: boolean;
}

export function ParameterCard({ paramKey, value, isEnabled }: ParameterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const documentation = getParameterDocumentation(paramKey);
  
  const displayName = formatParameterKey(paramKey);
  const displayValue = getParameterValue(paramKey, value);
  
  // If no documentation exists, show basic card
  if (!documentation) {
    return (
      <div className={`p-3 rounded-md ${
        isEnabled 
          ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30" 
          : "bg-zinc-50 dark:bg-zinc-900"
      }`}>
        <div className="flex justify-between items-center">
          <span className={`font-medium text-sm ${
            isEnabled ? "" : "text-muted-foreground"
          }`}>
            {displayName}
          </span>
          {displayValue && (
            <span className={`text-sm font-medium ${
              isEnabled 
                ? "text-green-700 dark:text-green-400" 
                : "text-muted-foreground"
            }`}>
              {displayValue}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border ${
      isEnabled 
        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30" 
        : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
    }`}>
      {/* Main parameter display */}
      <div className="p-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center hover:opacity-70 transition-opacity"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`font-medium text-sm ml-1 ${
                isEnabled ? "" : "text-muted-foreground"
              }`}>
                {displayName}
              </span>
            </button>
          </div>
          {displayValue && (
            <span className={`text-sm font-medium ${
              isEnabled 
                ? "text-green-700 dark:text-green-400" 
                : "text-muted-foreground"
            }`}>
              {displayValue}
            </span>
          )}
        </div>
      </div>

      {/* Expandable documentation */}
      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
          <div className="space-y-3 text-sm">
            {/* Description */}
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground">Description:</span>
                <p className="text-foreground mt-1">{documentation.description}</p>
              </div>
            </div>

            {/* Scan Time Impact */}
            <div className="flex items-start space-x-2">
              <Clock className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground">Scan Time:</span>
                <p className="text-foreground mt-1">{documentation.scanTime}</p>
              </div>
            </div>

            {/* Precision */}
            <div className="flex items-start space-x-2">
              <Target className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground">Precision:</span>
                <p className="text-foreground mt-1">{documentation.precision}</p>
              </div>
            </div>

            {/* Findings */}
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground">Findings:</span>
                <p className="text-foreground mt-1">{documentation.findings}</p>
              </div>
            </div>

            {/* Category badge */}
            <div className="pt-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400">
                {documentation.category}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 