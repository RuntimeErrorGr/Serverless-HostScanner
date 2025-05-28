"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "./auth-provider"
import { generalAPI } from "@/lib/api"
import { toast } from "sonner"

export function BanStatusChecker() {
  const { user, logout, isAuthenticated } = useAuth()
  const checkInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only check if user is authenticated
    if (!isAuthenticated || !user) {
      return
    }

    const checkBanStatus = async () => {
      try {
        const status = await generalAPI.checkBanStatus()
        
        if (status.is_banned) {
          // Clear any existing interval
          if (checkInterval.current) {
            clearInterval(checkInterval.current)
          }
          
          // Show ban notification
          const banReason = status.ban_info?.reason || "No reason provided"
          toast.error(`You have been banned from the platform. Reason: ${banReason}`)
          
          // Log out the user after a short delay
          setTimeout(() => {
            logout()
          }, 2000)
        }
      } catch (error) {
        // Silently handle errors - don't spam users with network errors
        console.warn("Failed to check ban status:", error)
      }
    }

    // Set up periodic checking every 30 seconds
    checkInterval.current = setInterval(checkBanStatus, 30000)

    // Cleanup on unmount or when authentication changes
    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current)
      }
    }
  }, [isAuthenticated, user, logout])

  // This component doesn't render anything
  return null
} 