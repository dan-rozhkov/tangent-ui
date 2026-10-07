"use client"

import { NowPlaying } from "@/components/ui/now-playing"
import { photo } from "@/lib/media"

const tracks = [
  { id: "undertow", title: "Undertow", artist: "Hollis Reed", duration: 214, artwork: photo("sea-at-dusk").src },
  { id: "dune-light", title: "Dune light", artist: "The Meridian Line", duration: 197, artwork: photo("terracotta-waves").src },
  { id: "low-tide", title: "Low tide", artist: "Harbor", duration: 185, artwork: photo("alpine-lake").src },
  { id: "ridge-line", title: "Ridge line", artist: "Northfield", duration: 238, artwork: photo("mountain-ridges").src },
]

export default function Demo() {
  return (
    // The mini bar rests at the centre of the box and the full player grows out of it, up and down. In the home tile the box shrinks to fit.
    <div className="flex h-[30rem] w-84 max-w-full items-center justify-center in-data-showcase-tile:h-[26rem] in-data-showcase-tile:w-72">
      <NowPlaying tracks={tracks} />
    </div>
  )
}
