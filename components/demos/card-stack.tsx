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
    id: "lisbon",
    name: "Lisbon",
    region: "Portugal",
    photo: "lisbon-rooftops",
  },
  {
    id: "alps",
    name: "Lake Oeschinen",
    region: "Switzerland",
    photo: "alpine-lake",
  },
  { id: "big-sur", name: "Big Sur", region: "California", photo: "coastline" },
  {
    id: "dolomites",
    name: "Dolomites",
    region: "Italy",
    photo: "mountain-ridges",
  },
  { id: "hvar", name: "Hvar", region: "Croatia", photo: "sea-at-dusk" },
  {
    id: "los-angeles",
    name: "Los Angeles",
    region: "California",
    photo: "concert-hall",
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
