"use client"

import { useMemo, useState } from "react"
import { X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Explains the ingest path (a real monitor like Grafana POSTs our webhook),
 * shows the exact Alertmanager-shaped payload, and fires it on confirm.
 */
export function IngestExplainerModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean
  onClose: () => void
  onSent: () => void
}) {
  const [sending, setSending] = useState(false)

  const payload = useMemo(
    () => ({
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "HighErrorRate",
            severity: "critical",
            service: "checkout-service",
          },
          annotations: {
            summary: "Elevated 5xx error rate on checkout",
          },
          fingerprint: `demo-${Date.now()}`,
        },
      ],
    }),
    [open],
  )

  if (!open) return null

  const send = async () => {
    setSending(true)
    try {
      await fetch("/api/alerts/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch {
      /* dashboard poll will reconcile */
    }
    setSending(false)
    onSent()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            How alerts reach Klaxon
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            In production your monitoring stack —{" "}
            <span className="font-medium text-foreground">Grafana</span>,
            Prometheus Alertmanager, Datadog — POSTs to the Klaxon webhook. We
            normalize the payload into an incident, idempotent by{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-foreground">
              dedup_key
            </code>{" "}
            and OCC-safe.
          </p>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-triggered/10 px-1.5 py-0.5 font-mono font-medium text-triggered ring-1 ring-inset ring-triggered/25">
              POST
            </span>
            <span className="font-mono text-muted-foreground">
              /api/alerts/ingest
            </span>
          </div>

          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
            <code>{JSON.stringify(payload, null, 2)}</code>
          </pre>

          <p className="text-xs text-muted-foreground/70">
            Confirm to send exactly this payload to the live webhook.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send to webhook"}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
