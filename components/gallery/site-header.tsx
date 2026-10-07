import Link from "next/link"

import { BrandMark } from "@/components/gallery/brand-mark"
import { HeaderActions } from "@/components/gallery/header-actions"
import { HeaderBackdrop } from "@/components/gallery/header-backdrop"
import { SiteMenu } from "@/components/gallery/site-menu"

const brandClass = "flex h-9 items-center px-1 text-foreground"

/** The sticky gallery header: menu button and brand on the left, search and settings on the right. The brand links to `brandHref` when given. */
export function SiteHeader({ brandHref }: { brandHref?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 sm:px-6">
      <HeaderBackdrop />
      <div className="flex items-center gap-1">
        <SiteMenu />
        {brandHref ? (
          <Link href={brandHref} aria-label="Tangent UI" className={brandClass}>
            <BrandMark className="h-5 w-auto" />
          </Link>
        ) : (
          <span role="img" aria-label="Tangent UI" className={brandClass}>
            <BrandMark className="h-5 w-auto" />
          </span>
        )}
      </div>
      <HeaderActions />
    </header>
  )
}
