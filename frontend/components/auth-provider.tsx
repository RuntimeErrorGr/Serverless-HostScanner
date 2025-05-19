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
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const initKeycloak = async () => {
      const keycloakInstance = new Keycloak({
        url: "https://kc-auth.linuxtecha.xyz",
        realm: "network-scanner",
        clientId: "fastapi-app",
      })

      try {
        const authenticated = await keycloakInstance.init({
          onLoad: "check-sso",
          silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
        })

        setKeycloak(keycloakInstance)
        setIsAuthenticated(authenticated)

        if (authenticated) {
          setUser({
            id: keycloakInstance.subject || "",
            name: keycloakInstance.tokenParsed?.name || keycloakInstance.tokenParsed?.preferred_username || "",
            email: keycloakInstance.tokenParsed?.email || "",
            token: keycloakInstance.token || "",
          })

          // If on login page, redirect to dashboard
          if (pathname === "/login") {
            router.push("/dashboard")
          }
        } else if (pathname !== "/login" && !pathname.includes("/silent-check-sso")) {
          // If not authenticated and not on login page, redirect to login
          router.push("/login")
        }
      } catch (error) {
        console.error("Failed to initialize Keycloak", error)
      } finally {
        setIsLoading(false)
      }
    }

    initKeycloak()
  }, [pathname, router])

  const login = () => {
    keycloak?.login()
  }

  const logout = () => {
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

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, logout }}>{children}</AuthContext.Provider>
  )
}
