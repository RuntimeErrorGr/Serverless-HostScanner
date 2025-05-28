"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Activity, Target, FileText, Shield, AlertTriangle } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const pathname = usePathname()

  const menuItems = [
    {
      title: "Dashboard",
      icon: BarChart3,
      href: "/dashboard",
    },
    {
      title: "Scans",
      icon: Activity,
      href: "/scans",
    },
    {
      title: "Targets",
      icon: Target,
      href: "/targets",
    },
    {
      title: "Findings",
      icon: AlertTriangle,
      href: "/findings",
    },
    {
      title: "Reports",
      icon: FileText,
      href: "/reports",
    },
    {
      title: "AdminX",
      icon: Shield,
      href: "/adminx",
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center px-4 py-5">
          <div className="flex items-center gap-2 font-semibold text-xl">
            <Target className="h-7 w-7" />
            <span>Host Scanner</span>
          </div>
          <div className="ml-auto md:hidden">
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2 py-4">
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href} className="mb-3">
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                tooltip={item.title}
                className="py-3 text-base"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 mr-3" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-sm text-muted-foreground">Host Scanner v1.4</div>
      </SidebarFooter>
    </Sidebar>
  )
}
