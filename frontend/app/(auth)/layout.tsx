import type React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Navbar } from "@/components/navbar"
import { Toaster } from "@/components/ui/toaster"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full">
          <Navbar />
          <main className="flex-1 w-full overflow-y-auto p-6 md:p-8 lg:p-10">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}