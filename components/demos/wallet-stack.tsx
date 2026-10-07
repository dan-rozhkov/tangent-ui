"use client"

import { AirplaneIcon, ShoppingBagIcon, TrainIcon } from "@phosphor-icons/react"

import { WalletStack } from "@/components/ui/wallet-stack"
import type { WalletCard } from "@/components/ui/wallet-stack"
import { avatar, photo } from "@/lib/media"

const icon = (Icon: typeof AirplaneIcon) => <Icon size={14} />

// Fictional issuers and numbers only; just the last four digits are ever shown.
const cards: WalletCard[] = [
  {
    id: "debit",
    issuer: "Fieldnote",
    product: "Everyday debit",
    lastFour: "4821",
    holder: "Jordan Hayes",
    expires: "09/29",
    variant: "metal",
    balance: 3248.6,
    balanceLabel: "Available",
    transactions: [
      { id: "t1", merchant: "Linen & Co", detail: "Home · Today", amount: -84.12, icon: icon(ShoppingBagIcon) },
      { id: "t2", merchant: "Emma Collins", detail: "Dinner split · Yesterday", amount: 36.5, avatar: avatar("emma-collins") },
      { id: "t3", merchant: "Blue Bottle", detail: "Coffee · Mon", amount: -6.5 },
    ],
  },
  {
    id: "travel",
    issuer: "Northbank",
    product: "Travel credit",
    lastFour: "0917",
    holder: "Jordan Hayes",
    expires: "03/28",
    variant: "color",
    tint: "oklch(42% .15 262)",
    balance: 812.4,
    balanceLabel: "Spent this month",
    transactions: [
      { id: "t1", merchant: "Alpine Air", detail: "Flight · Sat", amount: -412, icon: icon(AirplaneIcon) },
      { id: "t2", merchant: "Rail Pass", detail: "Transit · Fri", amount: -64.9, icon: icon(TrainIcon) },
      { id: "t3", merchant: "Refund", detail: "Seat upgrade · Thu", amount: 35.5 },
    ],
  },
  {
    id: "reserve",
    issuer: "Halo Reserve",
    product: "Black card",
    lastFour: "7730",
    holder: "Jordan Hayes",
    expires: "11/30",
    variant: "black",
    balance: 14200,
    balanceLabel: "Credit available",
    transactions: [
      { id: "t1", merchant: "Wine bar", detail: "Dining · Today", amount: -86 },
      { id: "t2", merchant: "Marcus Johnson", detail: "Tickets · Sun", amount: 120, avatar: avatar("marcus-johnson") },
    ],
  },
  {
    id: "savings",
    issuer: "Fieldstone",
    product: "Savings",
    lastFour: "3304",
    holder: "Jordan Hayes",
    variant: "glass",
    image: photo("sea-at-dusk").src,
    balance: 9150,
    balanceLabel: "Saved",
    transactions: [],
  },
]

export default function Demo() {
  return (
    // The stack scales with its width. The box is as tall as the open card with its activity, so the opened state stays inside it. In the home tile everything shrinks to fit.
    <div className="flex h-[34rem] w-74 max-w-full items-center justify-center in-data-showcase-tile:h-[26rem] in-data-showcase-tile:w-60">
      {/* The stack's own area has spare room below the cards for the open card, so it sits this much lower to rest centred. */}
      <div className="mt-24 w-full in-data-showcase-tile:mt-12">
        <WalletStack cards={cards} label="Jordan's cards" />
      </div>
    </div>
  )
}
