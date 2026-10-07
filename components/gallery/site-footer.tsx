import Link from "next/link"

import { BrandMark } from "@/components/gallery/brand-mark"
import { demos } from "@/components/demos"
import { catalog, categoryLabel } from "@/lib/catalog"

const routable = catalog.filter(item => item.name in demos)

const columns = [
  { title: categoryLabel("original"), items: routable.filter(item => item.category === "original") },
  { title: "Components", items: routable.filter(item => item.kind === "component" && item.category !== "original") },
  { title: "Blocks", items: routable.filter(item => item.kind === "block") },
].map(column => ({ ...column, items: column.items.slice(0, 5) }))

/** The gallery footer: a cropped brand lockup over a hairline, then a tagline and link columns. */
export function SiteFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="@container">
          <div
            aria-hidden
            className="pointer-events-none flex h-[calc(var(--lockup)*0.66)] select-none items-start gap-[0.12em] overflow-hidden font-display font-medium leading-none tracking-[-0.04em] whitespace-nowrap text-foreground [--lockup:calc(100cqw/5.55)] text-[length:var(--lockup)] [mask-image:linear-gradient(to_bottom,black,color-mix(in_srgb,black_35%,transparent))]"
          >
            <BrandMark className="mt-[0.07em] h-[0.72em] w-auto shrink-0" />
            <span className="-translate-y-[0.07em]">Tangent UI</span>
          </div>
        </div>
      </div>
      <div className="border-t border-border-subtle bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--foreground)_5%,transparent),transparent)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <p className="max-w-64 text-sm text-text-secondary">Animated React components on Base UI, Tailwind and Motion.</p>
            <p className="text-sm text-text-secondary">© {new Date().getFullYear()} Tangent UI</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {columns.map(column => (
              <div key={column.title} className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-foreground">{column.title}</h2>
                <ul className="flex flex-col gap-2">
                  {column.items.map(item => (
                    <li key={item.name}>
                      <Link href={`/components/${item.name}`} className="text-sm text-text-secondary transition-colors hover:text-foreground">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
