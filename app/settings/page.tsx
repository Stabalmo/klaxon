import { Send, Check, X } from "lucide-react"
import { Sidebar } from "@/components/klaxon/sidebar"
import { ResetDemoButton } from "@/components/klaxon/reset-demo-button"
import { getChannelStatus } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function ChannelCard({
  icon: Icon,
  name,
  detail,
  configured,
}: {
  icon: typeof Send
  name: string
  detail: string
  configured: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{name}</span>
        </div>
        <span
          className={
            configured
              ? "inline-flex items-center gap-1.5 text-xs font-medium text-acknowledged"
              : "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          }
        >
          <span
            className={`size-1.5 rounded-full ${configured ? "bg-acknowledged" : "bg-muted-foreground/50"}`}
          />
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export default async function SettingsPage() {
  const users = await getChannelStatus()
  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 md:px-6">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <h2 className="mb-1 text-sm font-medium text-foreground">
            Notification channels
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Klaxon pages on-call responders over Telegram with inline actions.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ChannelCard
              icon={Send}
              name="Telegram"
              detail="Inline acknowledge / resolve"
              configured={telegramConfigured}
            />
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Demo
            </h2>
            <ResetDemoButton />
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Responder reachability
            </h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Responder</th>
                    <th className="px-4 py-2.5 text-right font-medium">Telegram</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.name}>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {u.name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {u.telegram ? (
                          <Check className="ml-auto size-4 text-acknowledged" />
                        ) : (
                          <X className="ml-auto size-4 text-muted-foreground/40" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
