"use client"

import { useDialKit } from "dialkit"

import { NowPlaying } from "@/components/ui/now-playing"
import { photo } from "@/lib/media"

const tracks = [
  { id: "undertow", title: "Undertow", artist: "Hollis Reed", duration: 214, artwork: photo("sea-at-dusk").src },
  { id: "dune-light", title: "Dune light", artist: "The Meridian Line", duration: 197, artwork: photo("terracotta-waves").src },
  { id: "low-tide", title: "Low tide", artist: "Harbor", duration: 185, artwork: photo("alpine-lake").src },
  { id: "ridge-line", title: "Ridge line", artist: "Northfield", duration: 238, artwork: photo("mountain-ridges").src },
]

export default function Demo() {
  const dial = useDialKit(
    "Now playing",
    {
      startTrack: [0, 0, 3, 1],
      startExpanded: false,
      autoPlay: false,
    },
    { id: "now-playing" },
  )
  return (
    // The player rests at the bottom like an app's mini bar and grows upward into the full player.
    <div className="flex h-[27rem] w-full max-w-sm flex-col items-center justify-end">
      {/* The start values only seed the player, so changing one remounts it. */}
      <NowPlaying
        key={`${dial.startTrack}-${dial.startExpanded}-${dial.autoPlay}`}
        tracks={tracks}
        defaultIndex={dial.startTrack}
        defaultExpanded={dial.startExpanded}
        defaultPlaying={dial.autoPlay}
      />
    </div>
  )
}
