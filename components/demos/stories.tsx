"use client"

import { Stories } from "@/components/ui/stories"
import type { StoryAuthor } from "@/components/ui/stories"
import { person, photo } from "@/lib/media"
import type { PersonId, PhotoId } from "@/lib/media"

/** Seven people posting small glimpses of their day: portraits and landscapes mixed, some with a line over the photo. */
const feed: { who: PersonId; frames: { id: PhotoId; caption?: string; time: string }[] }[] = [
  {
    who: "emma-collins",
    frames: [
      { id: "attic-bedroom", caption: "New linen, old beams. Slept in until nine.", time: "2h" },
      { id: "window-nook", time: "2h" },
      { id: "desk-lamp", caption: "Reading hour starts now.", time: "1h" },
    ],
  },
  {
    who: "marcus-johnson",
    frames: [
      { id: "coffee-bar", caption: "Third flat white of the morning, no regrets.", time: "41m" },
      { id: "espresso-cups", time: "40m" },
    ],
  },
  {
    who: "jasmine-brooks",
    frames: [
      { id: "kyoto-street", caption: "Left the map at the hotel on purpose.", time: "5h" },
      { id: "kyoto-temple", time: "5h" },
      { id: "kyoto-rooftops", caption: "Found the pagoda from every angle but this one.", time: "4h" },
      { id: "ramen-bowl", caption: "Lunch.", time: "3h" },
    ],
  },
  {
    who: "olivia-bennett",
    frames: [{ id: "pine-forest", caption: "Fog before the first hike.", time: "7h" }],
  },
  {
    who: "sofia-ramirez",
    frames: [
      { id: "plant-studio", caption: "Forty plants, one window, zero room for a sofa.", time: "3h" },
      { id: "clay-vases", time: "3h" },
    ],
  },
  {
    who: "ryan-sullivan",
    frames: [
      { id: "desert-house", caption: "Four hours east of anywhere.", time: "9h" },
      { id: "sand-dunes", time: "8h" },
      { id: "rocky-cove", caption: "The long way back goes past the water.", time: "6h" },
    ],
  },
  {
    who: "hannah-walsh",
    frames: [
      { id: "teapot", caption: "A gift from the market, still smells of smoke.", time: "12h" },
      { id: "wool-blanket", time: "11h" },
    ],
  },
]

const authors: StoryAuthor[] = feed.map(({ who, frames }) => {
  const { id, name, src } = person(who)
  return {
    id,
    name: name.split(" ")[0],
    avatar: src,
    frames: frames.map(({ id: shot, caption, time }) => {
      const { src: file, width, height, alt } = photo(shot)
      return { src: file, width, height, alt, caption, time }
    }),
  }
})

export default function Demo() {
  return (
    <div className="w-full max-w-[522px]">
      <Stories authors={authors} label="Stories from friends" duration={5} />
    </div>
  )
}
