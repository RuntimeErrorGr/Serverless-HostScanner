"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Lock, Scan, Server, Globe, Database } from "lucide-react"

export default function LoginPage() {
  const { user, login, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="cyber-grid"></div>
        <div className="floating-elements">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="floating-element"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 15}s`,
              }}
            >
              {i % 5 === 0 ? (
                <Shield size={24} />
              ) : i % 5 === 1 ? (
                <Lock size={24} />
              ) : i % 5 === 2 ? (
                <Scan size={24} />
              ) : i % 5 === 3 ? (
                <Server size={24} />
              ) : (
                <Globe size={24} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        <div className="mb-8 flex items-center">
          <Shield className="h-12 w-12 mr-4" />
          <h1 className="text-4xl font-bold">Network Scanner</h1>
        </div>

        <Card className="w-full max-w-md bg-black/60 backdrop-blur-md border-gray-800">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-white drop-shadow">Secure Access Portal</CardTitle>
            <CardDescription className="text-center">Sign in to access your network scanning dashboard</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-400 text-center">
                This platform provides network scanning capabilities for security professionals.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="flex flex-col items-center text-center">
                <Scan className="h-8 w-8 mb-2 text-blue-400" />
                <span className="text-xs text-white drop-shadow">Advanced Scanning</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Database className="h-8 w-8 mb-2 text-blue-400" />
                <span className="text-xs text-white drop-shadow">Secure Cloud Storage</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Server className="h-8 w-8 mb-2 text-blue-400" />
                <span className="text-xs text-white drop-shadow">Real-time Results Analysis</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={login}>
              <Lock className="mr-2 h-4 w-4" />
              Sign in with Keycloak
            </Button>
          </CardFooter>
        </Card>

        <p className="mt-8 text-sm text-gray-500">© 2025 Network Scanner. All rights reserved.</p>
      </div>
    </div>
  )
}
