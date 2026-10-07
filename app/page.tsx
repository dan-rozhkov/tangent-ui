import Link from "next/link"

import { HeaderActions } from "@/components/gallery/header-actions"
import { catalog } from "@/lib/catalog"

const sections = [
  { id: "original", title: "Signature", note: "Morphing surfaces, glass, gestures and depth." },
  { id: "actions", title: "Actions" },
  { id: "inputs", title: "Inputs" },
  { id: "disclosure", title: "Disclosure" },
  { id: "data", title: "Data" },
  { id: "feedback", title: "Feedback" },
  { id: "text", title: "Text" },
  { id: "special", title: "Special" },
  { id: "blocks", title: "Blocks" },
]

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-background/90 px-4 backdrop-blur sm:px-6">
        <span className="font-display text-base font-medium tracking-display">Tangent UI</span>
        <HeaderActions />
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-14 sm:px-6">
        <section className="flex max-w-2xl flex-col gap-4">
          <h1 className="font-display text-4xl leading-display font-medium tracking-display text-balance">
            React components with calm, physical motion
          </h1>
          <p className="text-lg text-text-secondary">
            {catalog.length} components and blocks built on Base UI, Tailwind and Motion. Every demo is live: press, drag and scroll them.
          </p>
          <div>
            <Link
              href="/components/glass-tabbar"
              className="inline-flex h-control-md items-center rounded-control bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-160 hover:opacity-90"
            >
              Start with the glass tab bar
            </Link>
          </div>
        </section>
        {sections.map(section => {
          const items = catalog.filter(item => item.category === section.id)
          if (!items.length) return null
          return (
            <section key={section.id} className="flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-xl font-medium tracking-display">{section.title}</h2>
                <span className="text-sm text-text-muted tabular-nums">{items.length}</span>
              </div>
              {section.note && <p className="-mt-2 text-sm text-text-secondary">{section.note}</p>}
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                {items.map(item => (
                  <li key={item.name} className="min-w-0">
                    <Link
                      href={`/components/${item.name}`}
                      className="flex h-full flex-col gap-1 rounded-panel border border-border bg-surface p-4 transition-colors duration-160 hover:bg-surface-muted"
                    >
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="line-clamp-2 text-xs text-text-secondary">{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </main>
    </div>
  )
}
