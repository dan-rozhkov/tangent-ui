"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { catalog, categories, categoryLabel } from "@/lib/catalog"
import { cn } from "@/lib/utils"

export function Sidebar({ ported }: { ported: string[] }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-6 text-sm">
      {categories.map(category => (
        <div key={category} className="flex flex-col gap-0.5">
          <h2 className="px-3 pb-1 text-xs text-text-muted">{categoryLabel(category)}</h2>
          {catalog
            .filter(item => item.category === category)
            .map(item => {
              const ready = ported.includes(item.name)
              const active = pathname === `/components/${item.name}`
              return (
                <Link
                  key={item.name}
                  href={`/components/${item.name}`}
                  className={cn(
                    "rounded-control px-3 py-1.5 transition-colors duration-160 ease-standard",
                    active ? "bg-surface-muted text-foreground" : "text-text-secondary hover:text-foreground",
                    !ready && "text-text-muted",
                  )}
                >
                  {item.title}
                  {!ready && <span className="sr-only"> (not ported yet)</span>}
                </Link>
              )
            })}
        </div>
      ))}
    </nav>
  )
}
