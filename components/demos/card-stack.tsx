"use client"

import { CardStack } from "@/components/ui/card-stack"
import { photo, type PhotoId } from "@/lib/media"

const destinations: {
  id: string
  name: string
  region: string
  photo: PhotoId
}[] = [
  {
    id: "kyoto",
    name: "Kyoto",
    region: "Japan",
    photo: "kyoto-rooftops",
  },
  {
    id: "black-forest",
    name: "Black Forest",
    region: "Germany",
    photo: "pine-forest",
  },
  { id: "cannon-beach", name: "Cannon Beach", region: "Oregon", photo: "rocky-cove" },
  {
    id: "erg-chebbi",
    name: "Erg Chebbi",
    region: "Morocco",
    photo: "sand-dunes",
  },
  { id: "bled", name: "Lake Bled", region: "Slovenia", photo: "misty-lake" },
  {
    id: "new-delhi",
    name: "New Delhi",
    region: "India",
    photo: "concrete-tower",
  },
]

export default function Demo() {
  return (
    <CardStack
      items={destinations}
      getKey={(place) => place.id}
      getLabel={(place) => place.name}
      label="Destinations"
      labels={{ left: "Skip", right: "Shortlist" }}
      outcomes={{ left: "skipped", right: "shortlisted" }}
      renderCard={(place) => {
        const image = photo(place.photo)
        return (
          <div className="relative h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              draggable={false}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 grid gap-0.5 bg-linear-to-t from-[oklch(0%_0_0/.55)] to-transparent p-5 pt-12 text-white">
              <h3 className="m-0 text-lg leading-body font-medium">{place.name}</h3>
              <p className="m-0 text-sm text-[oklch(100%_0_0/.78)]">{place.region}</p>
            </div>
          </div>
        )
      }}
    />
  )
}
