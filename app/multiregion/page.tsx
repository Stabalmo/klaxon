import { Sidebar } from "@/components/klaxon/sidebar"
import { MultiRegionLab } from "@/components/klaxon/multiregion-lab"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default function MultiRegionPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 md:px-6">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Multi-region
          </h1>
        </header>
        <main className="flex-1">
          <MultiRegionLab />
        </main>
      </div>
    </div>
  )
}
