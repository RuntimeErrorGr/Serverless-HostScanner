"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Keycloak from "keycloak-js"
import { Loader2 } from "lucide-react"

// Function to sync user with backend database
async function syncUserWithDatabase(token: string) {
  try {
    console.log("Syncing user with database...");
    const response = await fetch('/api/auth/callback', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      console.log("User successfully synced with database");
      return true;
    } else {
      console.error("Failed to sync user with database:", response.status);
      return false;
    }
  } catch (error) {
    console.error("Error syncing user with database:", error);
    return false;
  }
}

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
  getToken: () => string | null
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

  // Function to store token in localStorage
  const saveToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kc-token', token);
    }
  };

  // Function to remove token from localStorage
  const removeToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kc-token');
    }
  };

  // Function to get token (for API calls)
  const getToken = (): string | null => {
    if (keycloak && keycloak.token) {
      return keycloak.token;
    }
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kc-token');
    }
    
    return null;
  };

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
          
          // Save token to localStorage
          if (keycloakInstance.token) {
            saveToken(keycloakInstance.token);
            console.log("Token saved to localStorage");
            
            // Sync user with database
            await syncUserWithDatabase(keycloakInstance.token);
          }
          
          setUser({
            id: keycloakInstance.subject || "",
            name: keycloakInstance.tokenParsed?.name || keycloakInstance.tokenParsed?.preferred_username || "",
            email: keycloakInstance.tokenParsed?.email || "",
            token: keycloakInstance.token || "",
          })

          // Setup token refresh
          keycloakInstance.onTokenExpired = () => {
            console.log("Token expired, attempting refresh...")
            keycloakInstance.updateToken(70).then(refreshed => {
              if (refreshed && keycloakInstance.token) {
                console.log("Token refreshed and updated");
                saveToken(keycloakInstance.token);
                
                // Sync user with database after token refresh
                syncUserWithDatabase(keycloakInstance.token).catch(err => 
                  console.error("Failed to sync user after token refresh:", err)
                );
                
                // Update user token
                setUser(prevUser => prevUser ? {
                  ...prevUser,
                  token: keycloakInstance.token || ""
                } : null);
              }
            }).catch(() => {
              console.error("Failed to refresh token")
              removeToken();
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
          removeToken();
          setUser(null)
          if (pathname !== "/login" && !pathname.includes("/silent-check-sso")) {
            router.push("/login")
          }
        }
      } catch (error) {
        console.error("Failed to initialize Keycloak:", error)
        setError(error instanceof Error ? error.message : "Failed to initialize authentication")
        setIsAuthenticated(false)
        removeToken();
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
    keycloak?.login({
      // Force the login to take place, avoiding silent SSO
      prompt: 'login'
    }).catch(err => console.error("Login failed:", err));
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    removeToken();
    keycloak?.logout()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
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
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, error, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}
