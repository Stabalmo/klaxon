"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  ChevronLeft,
  MoreVertical,
  Paperclip,
  Mic,
  Smartphone,
  Minus,
} from "lucide-react"

const SEV_EMOJI: Record<string, string> = {
  SEV1: "🔴",
  SEV2: "🟠",
  SEV3: "🟡",
}

// Demo persona — matches the seeded on-call user.
const ME = "Maya Chen"

// Telegram dark ("Night") palette.
const C = {
  bezel: "#0a0a0c",
  header: "#17212b",
  chat: "#0e1621",
  bubble: "#182533",
  inline: "#1f2c3a",
  accent: "#2ea6ff",
  textDim: "#7d8e9e",
}

type Msg = {
  id: string
  display_id: string
  title: string
  severity: string
  service_slug: string | null
  status: string
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[11px] font-semibold text-white">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 4.4}
              y={8 - i * 2.4}
              width="3"
              height={3 + i * 2.4}
              rx="0.6"
              fill="white"
            />
          ))}
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true" fill="none">
          <path
            d="M7.5 9.5l.01 0M2 5.5a8 8 0 0111 0M4.3 7.7a4.7 4.7 0 016.4 0"
            stroke="white"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11" aria-hidden="true">
          <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" fill="none" stroke="white" strokeOpacity="0.5" />
          <rect x="2" y="2" width="16" height="7" rx="1.3" fill="white" />
          <rect x="21.5" y="3.5" width="1.6" height="4" rx="0.8" fill="white" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  )
}

/**
 * In-app phone running the Telegram channel, so the full money-shot
 * (page -> acknowledge -> dashboard flips) shows on one screen.
 * The inline buttons hit the SAME idempotent endpoints as the real bot.
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
          .map((i) => ({
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

  // ---- collapsed: a clearly-labelled "demo phone" pill with a live badge ----
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-3 shadow-xl transition-colors hover:bg-secondary"
      >
        <span className="relative">
          <Smartphone className="size-5 text-foreground" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 size-2.5 animate-ping rounded-full bg-triggered" />
          )}
        </span>
        <span className="text-sm font-medium text-foreground">On-call phone</span>
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-triggered px-1.5 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex w-[300px] flex-col gap-2">
      {/* demo chrome — clearly NOT part of Telegram, with the collapse control */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Smartphone className="size-3.5" />
          Simulated on-call phone
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse phone"
          className="-mr-1 rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Minus className="size-4" />
        </button>
      </div>

      {/* phone */}
      <div
        style={{ backgroundColor: C.bezel }}
        className="flex h-[560px] max-h-[calc(100vh-7rem)] w-full flex-col overflow-hidden rounded-[2.4rem] p-2.5 shadow-2xl ring-1 ring-white/10"
      >
        <div
          style={{ backgroundColor: C.chat }}
          className="relative flex flex-1 flex-col overflow-hidden rounded-[1.9rem]"
        >
          {/* dynamic island */}
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />

          <div style={{ backgroundColor: C.header }}>
            <StatusBar />
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              <ChevronLeft className="size-5 text-white/60" aria-hidden="true" />
              <span
                style={{ backgroundColor: C.accent }}
                className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              >
                K
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-white">Klaxon Bot</p>
                <p className="text-[11px]" style={{ color: C.textDim }}>
                  bot
                </p>
              </div>
              <MoreVertical className="size-5 text-white/70" />
            </div>
          </div>

          {/* chat body */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {msgs.length === 0 && (
              <p className="mt-10 text-center text-xs" style={{ color: C.textDim }}>
                No pages yet — fire a test alert.
              </p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className="max-w-[85%]">
                <div
                  style={{ backgroundColor: C.bubble }}
                  className="rounded-2xl rounded-tl-md px-3 py-2 text-white"
                >
                  <p className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {SEV_EMOJI[m.severity] ?? "⚪"} {m.severity} · {m.display_id}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug">
                    {m.title}
                  </p>
                  <p className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {m.service_slug}
                  </p>
                  {m.status !== "triggered" && (
                    <p
                      className="mt-1 flex items-center justify-end gap-1 text-[11px]"
                      style={{ color: C.accent }}
                    >
                      <Check className="size-3" /> {m.status} · 9:41
                    </p>
                  )}
                </div>

                {m.status === "triggered" && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <button
                      onClick={() => act(m.id, "ack")}
                      style={{ backgroundColor: C.inline, color: C.accent }}
                      className="rounded-lg px-2 py-2 text-xs font-medium transition-colors hover:brightness-125"
                    >
                      ✅ Acknowledge
                    </button>
                    <button
                      onClick={() => act(m.id, "resolve")}
                      style={{ backgroundColor: C.inline, color: C.accent }}
                      className="rounded-lg px-2 py-2 text-xs font-medium transition-colors hover:brightness-125"
                    >
                      ✔️ Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* input bar (decorative) */}
          <div
            style={{ backgroundColor: C.header }}
            className="flex items-center gap-2 px-3 py-2.5"
          >
            <Paperclip className="size-5 shrink-0" style={{ color: C.textDim }} />
            <div
              className="flex-1 rounded-full px-3 py-1.5 text-xs"
              style={{ backgroundColor: C.chat, color: C.textDim }}
            >
              Message
            </div>
            <Mic className="size-5 shrink-0" style={{ color: C.textDim }} />
          </div>
        </div>
      </div>
    </div>
  )
}
