"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlarmClock,
  CalendarClock,
  GitBranch,
  Server,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ResponderAvatar } from "./responder-avatar"

const navItems = [
  { label: "Incidents", icon: AlarmClock, href: "/", badge: "3" },
  { label: "Schedules", icon: CalendarClock, href: "/schedules" },
  { label: "Escalation Policies", icon: GitBranch, href: "#" },
  { label: "Services", icon: Server, href: "#" },
  { label: "Settings", icon: Settings, href: "#" },
]

function PulseMark() {
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/30">
      <span className="absolute size-3 animate-ping rounded-full bg-primary/50" />
      <span className="relative size-2.5 rounded-full bg-primary" />
    </span>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/incidents")
    if (href === "#") return false
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <PulseMark />
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Klaxon
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Primary">
        {navItems.map((item) => {
          const active = isActive(item.href)
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
              {item.badge && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

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
