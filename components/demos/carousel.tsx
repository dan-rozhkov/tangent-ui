"use client"

import { useDialKit } from "dialkit"

import { Carousel } from "@/components/ui/carousel"
import { photo, type PhotoId } from "@/lib/media"

const suites: { id: PhotoId; name: string; detail: string }[] = [
  { id: "sunroom", name: "Garden suite", detail: "Sunroom with a round dining table" },
  { id: "living-room", name: "Beam suite", detail: "Timber beams and arched windows" },
  { id: "home-office", name: "Study suite", detail: "Wooden desk, deep green walls" },
  { id: "bedroom", name: "Linen suite", detail: "Oak headboard and striped linen" },
  { id: "reading-chair", name: "Reading suite", detail: "Armchair, ottoman, and a knit throw" },
]

export default function Demo() {
  const dial = useDialKit(
    "Carousel",
    {
      interval: [5000, 1000, 10000, 250],
      slideWidth: [340, 200, 480, 10],
      autoplay: false,
    },
    { id: "carousel" }
  )
  return (
    <div className="w-full max-w-xl">
      <Carousel
        label="Harbour suites"
        interval={dial.interval}
        slideSize={`min(80cqw, ${dial.slideWidth}px)`}
        autoplay={dial.autoplay}
      >
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
