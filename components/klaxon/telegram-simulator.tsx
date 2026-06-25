"use client"

import { useCallback, useEffect, useState } from "react"
import { Send, Minus, Check } from "lucide-react"

const SEV_EMOJI: Record<string, string> = {
  SEV1: "🔴",
  SEV2: "🟠",
  SEV3: "🟡",
}

// The demo persona — matches the seeded on-call user.
const ME = "Maya Chen"
const TG_BLUE = "#229ED9"

type Msg = {
  id: string
  display_id: string
  title: string
  severity: string
  service_slug: string | null
  status: string
}

/**
 * In-app mirror of the real Telegram channel, so the whole money-shot
 * (page -> acknowledge -> dashboard flips) can be shown on one screen.
 * The buttons hit the SAME idempotent ack/resolve endpoints as the real bot.
 */
export function TelegramSimulator() {
  const [open, setOpen] = useState(true)
  const [msgs, setMsgs] = useState<Msg[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents", { cache: "no-store" })
      const data = await res.json()
      if (data.ok) {
        const mine = (data.incidents as any[])
          .filter((i) => i.assignee_name === ME && i.status !== "resolved")
          .slice(0, 6)
          .reverse()
          .map((i: any) => ({
            id: i.id,
            display_id: i.display_id,
            title: i.title,
            severity: i.severity,
            service_slug: i.service_slug,
            status: i.status,
          }))
        setMsgs(mine)
      }
    } catch {
      /* next poll recovers */
    }
  }, [])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, 2000)
    return () => clearInterval(poll)
  }, [refresh])

  const act = async (id: string, action: "ack" | "resolve") => {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: action === "ack" ? "acknowledged" : "resolved" }
          : m,
      ),
    )
    try {
      await fetch(`/api/incidents/${id}/${action}`, { method: "POST" })
    } catch {
      /* refresh reconciles */
    }
    refresh()
  }

  const unread = msgs.filter((m) => m.status === "triggered").length

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ backgroundColor: TG_BLUE }}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg"
      >
        <Send className="size-4" />
        Telegram
        {unread > 0 && (
          <span
            style={{ color: TG_BLUE }}
            className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold"
          >
            {unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-80 flex-col overflow-hidden rounded-xl border border-border shadow-2xl">
      <div
        style={{ backgroundColor: TG_BLUE }}
        className="flex items-center justify-between px-3.5 py-2.5 text-white"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-white/20">
            <Send className="size-3.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">Klaxon Bot</p>
            <p className="text-[11px] text-white/80">on-call · {ME}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Minimize"
          className="text-white/80 transition-colors hover:text-white"
        >
          <Minus className="size-4" />
        </button>
      </div>

      <div className="flex max-h-96 flex-col gap-2.5 overflow-y-auto bg-background p-3">
        {msgs.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No pages yet — fire a test alert.
          </p>
        )}
        {msgs.map((m) => (
          <div
            key={m.id}
            className="max-w-[90%] rounded-lg rounded-tl-sm border border-border bg-card p-2.5"
          >
            <p className="font-mono text-[11px] text-muted-foreground">
              {SEV_EMOJI[m.severity] ?? "⚪"} {m.severity} · {m.display_id}
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
              {m.title}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {m.service_slug}
            </p>
            {m.status === "triggered" ? (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => act(m.id, "ack")}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
                >
                  ✅ Acknowledge
                </button>
                <button
                  onClick={() => act(m.id, "resolve")}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
                >
                  ✔️ Resolve
                </button>
              </div>
            ) : (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-acknowledged">
                <Check className="size-3" /> {m.status}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
