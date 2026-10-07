"use client"

import { ZoomGallery } from "@/components/ui/zoom-gallery"
import type { ZoomShot } from "@/components/ui/zoom-gallery"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

/** Rooms and buildings from an interiors portfolio: mixed portrait and landscape shots keep their own shapes. */
const portfolio: { id: PhotoId; name: string; note?: string }[] = [
  { id: "concrete-tower", name: "Balcony tower", note: "Deep ledges, hard shadows" },
  { id: "loft-living", name: "Loft living room", note: "Stairs as the centrepiece" },
  { id: "spiral-stair", name: "Spiral stair", note: "Shot from the ground floor" },
  { id: "plant-studio", name: "Greenhouse corner", note: "Forty plants, one window" },
  { id: "desert-house", name: "Mesa cabin", note: "Built from local stone" },
  { id: "attic-bedroom", name: "Attic bedroom", note: "Original beams, new linen" },
  { id: "pastel-arches", name: "Rose arcade", note: "Late afternoon, no people" },
  { id: "window-nook", name: "Reading nook", note: "Oak table, brass lamp" },
  { id: "studio-desk", name: "Empty desk", note: "Before the move-in" },
  { id: "clay-vases", name: "Blush and sage" },
  { id: "paper-lantern", name: "Lantern cluster", note: "Hung at three heights" },
  { id: "cane-chair", name: "Cane armchair", note: "Concrete floor, white wall" },
]

const shots: ZoomShot[] = portfolio.map(({ id, name, note }) => {
  const { src, width, height, alt } = photo(id)
  return { src, width, height, alt, name, note }
})

export default function Demo() {
  return (
    <div className="w-full max-w-[522px]">
      <ZoomGallery shots={shots} label="Interiors portfolio" minTile={160} spacing={8} />
    </div>
  )
}
