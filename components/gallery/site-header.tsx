import Link from "next/link"

import { BrandMark } from "@/components/gallery/brand-mark"
import { HeaderActions } from "@/components/gallery/header-actions"
import { SiteMenu } from "@/components/gallery/site-menu"

const brandClass = "flex h-9 items-center px-1 text-foreground"

// Progressive blur: stacked backdrop blurs, each masked to an overlapping band, strongest at the top and gone by the bottom edge.
const blurs = [12, 6, 3, 1]
const step = 100 / (blurs.length + 2)
const blurLayers = blurs.map((blur, i) => {
  const mask = `linear-gradient(to bottom, ${i === 0 ? "black 0%" : `transparent ${i * step}%`}, black ${(i + 1) * step}%, black ${(i + 2) * step}%, transparent ${(i + 3) * step}%)`
  return { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: mask, WebkitMaskImage: mask }
})

/** Sits behind the header bar and runs a little past it, so content blurs progressively as it scrolls under. */
function HeaderBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20">
      {blurLayers.map((style, i) => (
        <div key={i} className="absolute inset-0" style={style} />
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-background/90 via-background/70 via-60% to-transparent" />
    </div>
  )
}

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
