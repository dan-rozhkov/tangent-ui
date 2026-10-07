import { readdirSync } from "node:fs"
import path from "node:path"

import { SiteFooter } from "@/components/gallery/site-footer"
import { SiteHeader } from "@/components/gallery/site-header"
import { Sidebar } from "@/components/gallery/sidebar"

function portedNames() {
  return readdirSync(path.join(process.cwd(), "components/demos"))
    .filter(file => file.endsWith(".tsx"))
    .map(file => file.slice(0, -4))
}

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader brandHref="/" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-10 px-4 sm:px-6">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 md:block">
          <Sidebar ported={portedNames()} />
        </aside>
        <main className="min-w-0 flex-1 py-10">{children}</main>
      </div>
      <SiteFooter />
    </div>
  )
}
