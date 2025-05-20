"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Keycloak from "keycloak-js"
import { Loader2 } from "lucide-react"

type User = {
  id: string
  name: string
  email: string
  token: string
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const initKeycloak = async () => {
      console.log("Initializing Keycloak...")
      
      const keycloakInstance = new Keycloak({
        url: "https://kc-auth.linuxtecha.xyz",
        realm: "network-scanner",
        clientId: "fastapi-app",
      })

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Authentication timed out")), 4000)
      })

      try {
        // Get the base URL for the silent check
        const baseUrl = window.location.origin
        const silentCheckUrl = `${baseUrl}/silent-check-sso.html`
        console.log("Silent check SSO URL:", silentCheckUrl)

        // Race between Keycloak init and timeout
        const authenticated = await Promise.race([
          keycloakInstance.init({
            onLoad: "check-sso",
            silentCheckSsoRedirectUri: silentCheckUrl,
            checkLoginIframe: false, // Disable iframe checking which can cause issues
          }),
          timeoutPromise
        ])

        console.log("Keycloak initialization result:", authenticated)

        setKeycloak(keycloakInstance)
        setIsAuthenticated(authenticated)
        setError(null)

        if (authenticated) {
          console.log("User authenticated, setting up user data...")
          setUser({
            id: keycloakInstance.subject || "",
            name: keycloakInstance.tokenParsed?.name || keycloakInstance.tokenParsed?.preferred_username || "",
            email: keycloakInstance.tokenParsed?.email || "",
            token: keycloakInstance.token || "",
          })

          // Setup token refresh
          keycloakInstance.onTokenExpired = () => {
            console.log("Token expired, attempting refresh...")
            keycloakInstance.updateToken(70).catch(() => {
              console.error("Failed to refresh token")
              logout()
            })
          }

          // If on login page, redirect to dashboard
          if (pathname === "/login") {
            router.push("/dashboard")
          }
        } else {
          // Clear user data if not authenticated
          console.log("User not authenticated, clearing data...")
          setUser(null)
          if (pathname !== "/login" && !pathname.includes("/silent-check-sso")) {
            router.push("/login")
          }
        }
      } catch (error) {
        console.error("Failed to initialize Keycloak:", error)
        setError(error instanceof Error ? error.message : "Failed to initialize authentication")
        setIsAuthenticated(false)
        setUser(null)
        
        // Redirect to login on error if not already there
        if (pathname !== "/login") {
          router.push("/login")
        }
      } finally {
        setIsLoading(false)
      }
    }

    initKeycloak()

    // Cleanup function
    return () => {
      if (keycloak) {
        keycloak.onTokenExpired = undefined
      }
    }
  }, [pathname, router])

  const login = () => {
    keycloak?.login()
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    keycloak?.logout()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading authentication...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Authentication Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
