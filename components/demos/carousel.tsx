"use client"

import { Carousel } from "@/components/ui/carousel"
import { photo, type PhotoId } from "@/lib/media"

const suites: { id: PhotoId; name: string; detail: string }[] = [
  { id: "plant-studio", name: "Garden suite", detail: "Plants, a tall window, a leather sofa" },
  { id: "loft-living", name: "Loft suite", detail: "A timber stair and a grey sofa" },
  { id: "studio-desk", name: "Study suite", detail: "Pale desk, white panelled wall" },
  { id: "attic-bedroom", name: "Attic suite", detail: "Pitched pine beams and white linen" },
  { id: "window-nook", name: "Window suite", detail: "A sunlit corner, a lamp, and a book" },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <Carousel label="Guest suites" interval={5000}>
        {suites.map(suite => {
          const image = photo(suite.id)
          return (
            <figure key={suite.id} className="m-0 grid gap-3">
              <div className="aspect-[4/5] overflow-hidden rounded-panel bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic */}
                <img src={image.src} alt={image.alt} draggable={false} className="size-full object-cover" />
              </div>
              <figcaption className="grid gap-0.5 px-1">
                <span className="text-sm font-medium text-foreground">{suite.name}</span>
                <span className="text-xs text-text-secondary">{suite.detail}</span>
              </figcaption>
            </figure>
          )
        })}
      </Carousel>
    </div>
  )
}
