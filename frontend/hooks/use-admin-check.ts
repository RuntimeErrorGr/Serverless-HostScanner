"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { generalAPI } from "@/lib/api"

export function useAdminCheck() {
  const { user, isAuthenticated } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isAuthenticated || !user) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        
        const response = await generalAPI.checkAdminStatus()
        setIsAdmin(response.is_admin || false)
      } catch (err) {
        console.error("Failed to check admin status:", err)
        setError("Failed to check admin status")
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminStatus()
  }, [isAuthenticated, user])

  return { isAdmin, isLoading, error }
} 