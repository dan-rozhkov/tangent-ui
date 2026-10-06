"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SlotText } from "@/components/ui/slot-text"

export default function Demo() {
  const [revenue, setRevenue] = useState(12480)
  const [live, setLive] = useState(false)

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <SlotText className="text-4xl font-medium" value={revenue} format={(value) => `$${value.toLocaleString("en-US")}`} announce />
        <Button size="sm" variant="secondary" onClick={() => setRevenue(Math.round(500 + Math.random() * 99_000))}>
          New total
        </Button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <SlotText className="text-2xl font-medium" value={live ? "Live now" : "Soon"} spins={2} />
        <Button size="sm" variant="secondary" onClick={() => setLive((value) => !value)}>
          Toggle
        </Button>
      </div>
    </div>
  )
}
