"use client"

import { ImageCompare } from "@/components/ui/image-compare"
import { photo } from "@/lib/media"

const ridges = photo("mountain-ridges")

export default function Demo() {
  return (
    <div className="w-full max-w-2xl">
      <ImageCompare
        before={
          // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic
          <img src={ridges.src} alt="Unedited photo of layered mountain ridges" className="grayscale" />
        }
        after={
          // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the demo framework agnostic
          <img src={ridges.src} alt="Colour graded photo of layered mountain ridges" />
        }
        aspectRatio="3 / 2"
      />
    </div>
  )
}
