import Link from "next/link"

import { HeaderActions } from "@/components/gallery/header-actions"
import { SiteMenu } from "@/components/gallery/site-menu"

const brandClass = "font-display text-base font-medium tracking-display"

/** The sticky gallery header: menu button and brand on the left, search and settings on the right. The brand links to `brandHref` when given. */
export function SiteHeader({ brandHref }: { brandHref?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2">
        <SiteMenu />
        {brandHref ? (
          <Link href={brandHref} className={brandClass}>
            Tangent UI
          </Link>
        ) : (
          <span className={brandClass}>Tangent UI</span>
        )}
      </div>
      <HeaderActions />
    </header>
  )
}
