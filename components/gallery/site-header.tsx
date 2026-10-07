import Link from "next/link"

import { HeaderActions } from "@/components/gallery/header-actions"
import { SiteMenu } from "@/components/gallery/site-menu"

const brandClass = "flex h-9 items-center px-1 text-foreground"

/** The Tangent monogram, filled with the current text color. */
function BrandMark() {
  return (
    <svg viewBox="0 0 342 363" fill="currentColor" width={19} height={20} aria-hidden className="h-5 w-auto">
      <path d="M0 115 94 83v105L0 220Z" />
      <path d="M119 73 342 0v104l-117 39v56a58 58 0 0 0 58 58h59v106h-59A164 164 0 0 1 119 199Z" />
    </svg>
  )
}

/** The sticky gallery header: menu button and brand on the left, search and settings on the right. The brand links to `brandHref` when given. */
export function SiteHeader({ brandHref }: { brandHref?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-1">
        <SiteMenu />
        {brandHref ? (
          <Link href={brandHref} aria-label="Tangent UI" className={brandClass}>
            <BrandMark />
          </Link>
        ) : (
          <span role="img" aria-label="Tangent UI" className={brandClass}>
            <BrandMark />
          </span>
        )}
      </div>
      <HeaderActions />
    </header>
  )
}
