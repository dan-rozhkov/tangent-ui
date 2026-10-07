"use client"

import { LightboxGallery } from "@/components/ui/lightbox-gallery"
import type { LightboxImage } from "@/components/ui/lightbox-gallery"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

/** A week in Kyoto and a few places further out: mixed portrait and landscape shots keep their own shapes. */
const trip: { id: PhotoId; title: string; caption?: string }[] = [
  { id: "kyoto-street", title: "Ninenzaka", caption: "Before the crowds arrive" },
  { id: "kyoto-rooftops", title: "Yasaka Pagoda", caption: "Between the tiled roofs" },
  { id: "sushi-counter", title: "Rolls at the counter", caption: "Gion, a little after eight" },
  { id: "kyoto-temple", title: "Kiyomizu-dera", caption: "Above the green hills" },
  { id: "pastel-arches", title: "Pink arcade", caption: "A long, quiet corridor" },
  { id: "noodle-bar", title: "Noodles after dark", caption: "A small table by the window" },
  { id: "rocky-cove", title: "A hidden cove", caption: "A steep path down the cliff" },
  { id: "coffee-bar", title: "Espresso at the bar", caption: "Open until late" },
  { id: "spiral-stair", title: "Looking up", caption: "Five floors, no lift" },
  { id: "ramen-bowl", title: "A bowl of ramen" },
  { id: "desert-house", title: "A house in the desert", caption: "Midday heat" },
  { id: "misty-lake", title: "Last light", caption: "Thursday, before the mist" },
]

const images: LightboxImage[] = trip.map(({ id, title, caption }) => {
  const { src, width, height, alt } = photo(id)
  return { src, width, height, alt, title, caption }
})

export default function Demo() {
  return (
    <div className="w-full max-w-[522px]">
      <LightboxGallery images={images} label="Kyoto photos" minColumnWidth={160} gap={8} />
    </div>
  )
}
