"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { SlotText } from "@/components/ui/slot-text"

export default function Demo() {
  const [revenue, setRevenue] = useState(12480)
  const [live, setLive] = useState(false)
  const dials = useDialKit(
    "Slot text",
    {
      duration: [0.9, 0.2, 3, 0.05],
      stagger: [0.07, 0, 0.3, 0.01],
      revenueSpins: [1, 0, 4, 1],
      statusSpins: [2, 0, 4, 1],
      announce: true,
      shuffle: { type: "action", label: "New total" },
    },
    { id: "slot-text", onAction: () => setRevenue(Math.round(500 + Math.random() * 99_000)) },
  )

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <SlotText
          className="text-4xl font-medium"
          value={revenue}
          format={(value) => `$${value.toLocaleString("en-US")}`}
          duration={dials.duration}
          stagger={dials.stagger}
          spins={dials.revenueSpins}
          announce={dials.announce}
        />
        <Button size="sm" variant="secondary" onClick={() => setRevenue(Math.round(500 + Math.random() * 99_000))}>
          New total
        </Button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <SlotText
          className="text-2xl font-medium"
          value={live ? "Live now" : "Soon"}
          duration={dials.duration}
          stagger={dials.stagger}
          spins={dials.statusSpins}
        />
        <Button size="sm" variant="secondary" onClick={() => setLive((value) => !value)}>
          Toggle
        </Button>
      </div>
    </div>
  )
}
