"use client"

import { MiniPlayer } from "@/components/ui/mini-player"
import { photo } from "@/lib/media"

const queue = [
  { id: "salt-and-tin", title: "Salt and tin", performer: "Wren Calloway", duration: 203, artwork: photo("rocky-cove").src },
  { id: "paper-moons", title: "Paper moons", performer: "Low Tide Choir", duration: 176, artwork: photo("paper-lantern").src },
  { id: "slow-ferry", title: "Slow ferry", performer: "Oda Lindqvist", duration: 222, artwork: photo("desert-house").src },
  { id: "amber-hours", title: "Amber hours", performer: "Pale Kestrel", duration: 191, artwork: photo("window-nook").src },
]

export default function Demo() {
  return (
    // The mini bar rests at the centre of the box and the full player grows out of it, up and down. In the home tile the box shrinks to fit.
    <div className="flex h-[30rem] w-84 max-w-full items-center justify-center in-data-showcase-tile:h-[26rem] in-data-showcase-tile:w-72">
      <MiniPlayer queue={queue} />
    </div>
  )
}
