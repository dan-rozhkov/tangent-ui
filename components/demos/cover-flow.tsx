"use client"

import { useState } from "react"

import { CoverFlow } from "@/components/ui/cover-flow"
import type { CoverFlowItem } from "@/components/ui/cover-flow"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

interface Place extends CoverFlowItem {
  season: string
}

const place = (id: PhotoId, title: string, subtitle: string, meta: string, season: string, imagePosition?: string): Place => ({
  id,
  title,
  subtitle,
  meta,
  season,
  image: photo(id).src,
  alt: photo(id).alt,
  imagePosition,
})

const places: Place[] = [
  place("mountain-ridges", "Ridge walk", "Dolomites", "12 km", "Best in October"),
  place("alpine-lake", "Lake loop", "Bernese Alps", "8 km", "Best in September"),
  place("coastline", "Cliff path", "Algarve", "14 km", "Best in November"),
  place("sea-at-dusk", "Evening shore", "Menorca", "5 km", "Best in October"),
  place("lisbon-rooftops", "Old town stairs", "Lisbon", "6 km", "Best in October"),
  place("lisbon-tram", "Tram 28 line", "Lisbon", "7 km", "Best in November"),
  place("terracotta-waves", "Red walls", "Marrakech", "4 km", "Best in December"),
]

export default function Demo() {
  const [index, setIndex] = useState(2)

  return (
    <div className="w-full max-w-[522px]">
      <CoverFlow
        label="Walks for this fall"
        items={places}
        index={index}
        onIndexChange={setIndex}
        renderCaption={(item) => (
          <>
            <p className="m-0 max-w-full truncate text-lg leading-[1.3] font-medium">{item.title}</p>
            <p className="m-0 max-w-full truncate text-sm leading-[1.4] text-text-secondary">
              {item.subtitle} · {item.meta} · {item.season}
            </p>
          </>
        )}
      />
    </div>
  )
}
