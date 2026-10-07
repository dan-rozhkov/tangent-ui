"use client"

import { useState } from "react"

import { DepthRail } from "@/components/ui/depth-rail"
import type { DepthRailItem } from "@/components/ui/depth-rail"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

interface Piece extends DepthRailItem {
  lead: string
}

const piece = (id: PhotoId, name: string, byline: string, stat: string, lead: string, imagePosition?: string): Piece => ({
  id,
  name,
  byline,
  stat,
  lead,
  image: photo(id).src,
  alt: photo(id).alt,
  imagePosition,
})

const pieces: Piece[] = [
  piece("teapot", "Burrow teapot", "Mara Quill", "$86", "Ships in 3 days"),
  piece("clay-vases", "Blush vase pair", "Tomo Ferreira", "$124", "Ships in 5 days"),
  piece("desk-lamp", "Brass reading lamp", "Linden Works", "$210", "Ships in 2 days"),
  piece("espresso-cups", "Stone cup set", "Mara Quill", "$58", "Ships in 3 days"),
  piece("paper-lantern", "Cloud lantern", "Hoku & Reed", "$72", "Made to order"),
  piece("wool-blanket", "Caramel throw", "Fenwick Mill", "$148", "Ships in 4 days"),
  piece("cane-chair", "Cane armchair", "Linden Works", "$640", "Made to order"),
]

export default function Demo() {
  const [active, setActive] = useState(2)

  return (
    <div className="w-full max-w-[522px]">
      <DepthRail
        label="Studio picks this week"
        slides={pieces}
        active={active}
        onActiveChange={setActive}
        renderInfo={(item) => (
          <>
            <p className="m-0 max-w-full truncate text-lg leading-[1.3] font-medium">{item.name}</p>
            <p className="m-0 max-w-full truncate text-sm leading-[1.4] text-text-secondary">
              {item.byline} · {item.stat} · {item.lead}
            </p>
          </>
        )}
      />
    </div>
  )
}
