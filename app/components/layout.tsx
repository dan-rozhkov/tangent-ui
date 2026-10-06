import { readdirSync } from "node:fs"
import path from "node:path"
import Link from "next/link"

import { Appearance } from "@/components/gallery/appearance"
import { Sidebar } from "@/components/gallery/sidebar"

function portedNames() {
  return readdirSync(path.join(process.cwd(), "components/demos"))
    .filter(file => file.endsWith(".tsx"))
    .map(file => file.slice(0, -4))
}

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-background/90 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="font-display text-base font-medium tracking-display">
          Tangent UI
        </Link>
        <Appearance />
      </header>
      <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 md:block">
          <Sidebar ported={portedNames()} />
        </aside>
        <main className="min-w-0 flex-1 py-10">{children}</main>
      </div>
    </div>
  )
}
