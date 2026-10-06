"use client"

import { LightboxGallery } from "@/components/ui/lightbox-gallery"
import type { LightboxImage } from "@/components/ui/lightbox-gallery"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

/** A week in Lisbon and along the coast: mixed portrait and landscape shots keep their own shapes. */
const trip: { id: PhotoId; title: string; caption?: string }[] = [
  { id: "lisbon-tram", title: "Tram 28", caption: "Graça, Monday morning" },
  { id: "lisbon-rooftops", title: "Alfama rooftops", caption: "From the Santa Luzia lookout" },
  { id: "coastline", title: "Ursa beach", caption: "A steep path down from Cabo da Roca" },
  { id: "lisbon-bridge", title: "25 de Abril Bridge", caption: "Crossing to Almada" },
  { id: "salmon-dinner", title: "Dinner at Prado" },
  { id: "terracotta-waves", title: "Terracotta walls", caption: "Comporta" },
  { id: "sea-at-dusk", title: "Last light", caption: "Ericeira, Thursday" },
  { id: "wine-bar", title: "A carafe of red", caption: "Bairro Alto" },
  { id: "curved-facade", title: "Curved balconies" },
  { id: "alpine-lake", title: "Detour north", caption: "Serra da Estrela" },
]

const images: LightboxImage[] = trip.map(({ id, title, caption }) => {
  const { src, width, height, alt } = photo(id)
  return { src, width, height, alt, title, caption }
})

export default function Demo() {
  return (
    <div className="w-full max-w-[720px]">
      <LightboxGallery images={images} label="Lisbon trip" minColumnWidth={128} gap={8} />
    </div>
  )
}
