"use client"

import { useDialKit } from "dialkit"

import { LightboxGallery } from "@/components/ui/lightbox-gallery"
import type { LightboxImage } from "@/components/ui/lightbox-gallery"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

/** A week in Lisbon and along the coast: mixed portrait and landscape shots keep their own shapes. */
const trip: { id: PhotoId; title: string; caption?: string }[] = [
  { id: "lisbon-tram", title: "Tram 28", caption: "Graça, Monday morning" },
  { id: "lisbon-rooftops", title: "Alfama rooftops", caption: "From the Santa Luzia lookout" },
  { id: "chef-plating", title: "The pass at Prado", caption: "Baixa, a little after eight" },
  { id: "lisbon-bridge", title: "25 de Abril Bridge", caption: "Crossing to Almada" },
  { id: "terracotta-waves", title: "Terracotta walls", caption: "Comporta" },
  { id: "restaurant", title: "Under the pendant lights", caption: "Príncipe Real" },
  { id: "coastline", title: "Ursa beach", caption: "A steep path down from Cabo da Roca" },
  { id: "wine-bar", title: "A carafe of red", caption: "Bairro Alto" },
  { id: "curved-facade", title: "Curved balconies", caption: "Parque das Nações" },
  { id: "salmon-dinner", title: "Dinner at Prado" },
  { id: "pool-house", title: "A house by the pool", caption: "Melides" },
  { id: "sea-at-dusk", title: "Last light", caption: "Ericeira, Thursday" },
]

const images: LightboxImage[] = trip.map(({ id, title, caption }) => {
  const { src, width, height, alt } = photo(id)
  return { src, width, height, alt, title, caption }
})

export default function Demo() {
  const props = useDialKit(
    "Lightbox gallery",
    {
      minColumnWidth: [160, 100, 300, 10],
      gap: [8, 0, 24, 1],
      label: { type: "text", default: "Lisbon photos" },
    },
    { id: "lightbox-gallery" },
  )
  return (
    <div className="w-full max-w-[522px]">
      <LightboxGallery images={images} label={props.label} minColumnWidth={props.minColumnWidth} gap={props.gap} />
    </div>
  )
}
