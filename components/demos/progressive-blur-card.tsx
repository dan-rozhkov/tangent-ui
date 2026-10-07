"use client"

import { ProgressiveBlurCardStack } from "@/components/ui/progressive-blur-card"
import type { ProgressiveBlurCardStackItem } from "@/components/ui/progressive-blur-card"
import { avatar, photo } from "@/lib/media"
import type { PersonId, PhotoId } from "@/lib/media"

const creator = (
  id: string,
  shot: PhotoId,
  face: PersonId,
  name: string,
  handle: string,
  caption: string,
  bio: string,
  stats: [string, string, string],
  badge?: string
): ProgressiveBlurCardStackItem => ({
  id,
  image: { src: photo(shot).src, alt: photo(shot).alt },
  avatar: { src: avatar(face) },
  name,
  handle,
  caption,
  bio,
  badge,
  stats: [
    { label: "Posts", value: stats[0] },
    { label: "Followers", value: stats[1] },
    { label: "Saves", value: stats[2] },
  ],
})

const creators: ProgressiveBlurCardStackItem[] = [
  creator(
    "lena",
    "misty-lake",
    "jasmine-brooks",
    "Lena Marchetti",
    "@lena.frames",
    "Travel & Film",
    "Slow mornings, 35mm light, and the quiet hour before a lake wakes up.",
    ["248", "18.4k", "92k"],
    "Top creator"
  ),
  creator(
    "odile",
    "pastel-arches",
    "sofia-ramirez",
    "Odile Ferrand",
    "@odile.walks",
    "Architecture",
    "Chasing pink corridors and curved shadows in warm-weather cities.",
    ["412", "31.2k", "140k"]
  ),
  creator(
    "kenji",
    "kyoto-rooftops",
    "daniel-kim",
    "Kenji Aoyama",
    "@kenji.roofs",
    "Street & Culture",
    "Weekend wanderer with a soft spot for old tiles, temples, and tea.",
    ["187", "9.8k", "41k"]
  ),
  creator(
    "mara",
    "pine-forest",
    "olivia-bennett",
    "Mara Lindqvist",
    "@mara.north",
    "Outdoors & Slow Living",
    "Foggy ridgelines, thermos in hand. Notes from the trail, no hurry.",
    ["326", "22.7k", "88k"]
  ),
]

export default function Demo() {
  return (
    <div className="flex w-full justify-center">
      <ProgressiveBlurCardStack label="Featured creators" items={creators} />
    </div>
  )
}
