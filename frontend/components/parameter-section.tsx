"use client"

import { useState } from "react"
import { ParameterCard } from "./parameter-card"

interface ParameterSectionProps {
  parameters: Record<string, any>;
}

function isParameterEnabled(value: any): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  return true // Non-boolean values are considered "enabled" if they exist
}

export function ParameterSection({ parameters }: ParameterSectionProps) {
  const [enabledExpanded, setEnabledExpanded] = useState(true)
  const [disabledExpanded, setDisabledExpanded] = useState(false)
  
  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <p>No parameters available</p>
      </div>
    );
  }
  
  // Separate enabled and disabled parameters
  const paramEntries = Object.entries(parameters);
  const enabledParams = paramEntries.filter(([key, value]) => isParameterEnabled(value));
  const disabledParams = paramEntries.filter(([key, value]) => !isParameterEnabled(value));
  
  return (
    <div className="space-y-4">
      {enabledParams.length > 0 && (
        <div>
          <button
            onClick={() => setEnabledExpanded(!enabledExpanded)}
            className="flex items-center w-full text-left text-sm font-medium text-muted-foreground mb-3 hover:text-foreground transition-colors"
          >
            <svg
              className={`h-4 w-4 mr-2 transition-transform ${enabledExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Enabled ({enabledParams.length})
          </button>
          {enabledExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {enabledParams.map(([key, value]) => (
                <ParameterCard
                  key={key}
                  paramKey={key}
                  value={value}
                  isEnabled={true}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {disabledParams.length > 0 && (
        <div>
          <button
            onClick={() => setDisabledExpanded(!disabledExpanded)}
            className="flex items-center w-full text-left text-sm font-medium text-muted-foreground mb-3 hover:text-foreground transition-colors"
          >
            <svg
              className={`h-4 w-4 mr-2 transition-transform ${disabledExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Disabled ({disabledParams.length})
          </button>
          {disabledExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {disabledParams.map(([key, value]) => (
                <ParameterCard
                  key={key}
                  paramKey={key}
                  value={value}
                  isEnabled={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 