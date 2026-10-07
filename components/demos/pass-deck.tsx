"use client"

import { BarbellIcon, BicycleIcon, TrainIcon } from "@phosphor-icons/react"

import { PassDeck } from "@/components/ui/pass-deck"
import type { Pass } from "@/components/ui/pass-deck"
import { avatar, photo } from "@/lib/media"

const icon = (Icon: typeof TrainIcon) => <Icon size={14} />

// Fictional brands and numbers only; just the trailing digits are ever shown.
const passes: Pass[] = [
  {
    id: "transit",
    brand: "Metrolane",
    title: "Monthly transit",
    tail: "2056",
    owner: "Sam Whitaker",
    renews: "02/27",
    finish: "brushed",
    amount: 41.75,
    amountLabel: "Ride credit",
    activity: [
      { id: "a1", name: "Line 4 to Harbor", detail: "Single ride · Today", delta: -2.75, icon: icon(TrainIcon) },
      { id: "a2", name: "Top-up", detail: "Auto reload · Tue", delta: 25, icon: icon(TrainIcon) },
      { id: "a3", name: "Night bus", detail: "Zone 2 · Mon", delta: -3.5 },
    ],
  },
  {
    id: "bikes",
    brand: "Spoke & Co",
    title: "City bike share",
    tail: "6612",
    owner: "Sam Whitaker",
    renews: "08/26",
    finish: "tint",
    tint: "oklch(48% .13 168)",
    amount: 18.2,
    amountLabel: "Spent this month",
    activity: [
      { id: "a1", name: "Dock 12 to Pier", detail: "24 min · Sun", delta: -4.1, icon: icon(BicycleIcon) },
      { id: "a2", name: "Day pass", detail: "Weekend · Sat", delta: -9, icon: icon(BicycleIcon) },
      { id: "a3", name: "Promo credit", detail: "Referral · Fri", delta: 5 },
    ],
  },
  {
    id: "gym",
    brand: "Ironworks",
    title: "Founders club",
    tail: "0381",
    owner: "Sam Whitaker",
    renews: "05/28",
    finish: "onyx",
    amount: 120,
    amountLabel: "Class credit",
    activity: [
      { id: "a1", name: "Strength studio", detail: "Class · Today", delta: -18, icon: icon(BarbellIcon) },
      { id: "a2", name: "Marcus Johnson", detail: "Guest visit · Sat", delta: -12, avatar: avatar("marcus-johnson") },
    ],
  },
  {
    id: "roastery",
    brand: "Ember Roasters",
    title: "Regulars card",
    tail: "9174",
    owner: "Sam Whitaker",
    finish: "frost",
    image: photo("misty-lake").src,
    amount: 7.5,
    amountLabel: "Reward balance",
    activity: [],
  },
]

export default function Demo() {
  return (
    // The stack scales with its width. The box is as tall as the open card with its activity, so the opened state stays inside it. In the home tile everything shrinks to fit.
    <div className="flex h-[34rem] w-74 max-w-full items-center justify-center in-data-showcase-tile:h-[26rem] in-data-showcase-tile:w-60">
      {/* The stack's own area has spare room below the cards for the open card, so it sits this much lower to rest centred. */}
      <div className="mt-24 w-full in-data-showcase-tile:mt-12">
        <PassDeck passes={passes} label="Sam's passes" />
      </div>
    </div>
  )
}
