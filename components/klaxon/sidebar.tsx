"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlarmClock,
  CalendarClock,
  GitBranch,
  Globe,
  Server,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ResponderAvatar } from "./responder-avatar"
import { ClusterStatus } from "./cluster-status"
import { LogoMark } from "./logo-mark"

type NavItem = {
  label: string
  icon: typeof AlarmClock
  href: string
  soon?: boolean
  badge?: boolean
}

const navItems: NavItem[] = [
  { label: "Incidents", icon: AlarmClock, href: "/", badge: true },
  { label: "Multi-region", icon: Globe, href: "/multiregion" },
  { label: "Schedules", icon: CalendarClock, href: "/schedules" },
  { label: "Escalation Policies", icon: GitBranch, href: "#", soon: true },
  { label: "Services", icon: Server, href: "#", soon: true },
  { label: "Settings", icon: Settings, href: "/settings" },
]

export function Sidebar() {
  const pathname = usePathname()
  const [openCount, setOpenCount] = useState<number | null>(null)

  // Live open-incident count for the Incidents badge.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" })
        const data = await res.json()
        if (alive && data.ok) setOpenCount(data.open)
      } catch {
        /* ignore */
      }
    }
    load()
    const poll = setInterval(load, 4000)
    return () => {
      alive = false
      clearInterval(poll)
    }
  }, [])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/incidents")
    if (href === "#") return false
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <LogoMark className="size-9 shrink-0" />
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Klaxon
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Primary">
        {navItems.map((item) => {
          if (item.soon) {
            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground/40"
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60">
                  soon
                </span>
              </div>
            )
          }

          const active = isActive(item.href)
          const showBadge = item.badge && openCount != null && openCount > 0

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
              {showBadge && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                  {openCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-1">
        <ClusterStatus />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <ResponderAvatar initials="MC" tone="var(--chart-1)" className="size-7" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              Maya Chen
            </p>
            <p className="truncate text-xs text-muted-foreground">
              On-call · Platform
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
