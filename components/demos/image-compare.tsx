"use client"

import { ImageCompare } from "@/components/ui/image-compare"
import { photo } from "@/lib/media"

const dunes = photo("sand-dunes")

export default function Demo() {
  return (
    <div className="w-full max-w-2xl">
      <ImageCompare
        before={
          // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic
          <img src={dunes.src} alt="Unedited photo of rippled sand dunes" className="grayscale" />
        }
        after={
          // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic
          <img src={dunes.src} alt="Colour graded photo of rippled sand dunes" />
        }
        aspectRatio="4 / 3"
      />
    </div>
  )
}
