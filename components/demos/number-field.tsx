"use client"

import { useState } from "react"

import { NumberField } from "@/components/ui/number-field"

export default function Demo() {
  const [seats, setSeats] = useState(5)

  return (
    <div className="grid w-full max-w-80 gap-6">
      <NumberField
        label="Seats"
        value={seats}
        onValueChange={setSeats}
        min={1}
        max={500}
        suffix={n => (n === 1 ? " seat" : " seats")}
        scrub
      />
      <NumberField label="Price" defaultValue={24.5} min={0} max={1000} step={0.5} prefix="$" description="Drag the label or hold a button to change it faster." />
      <NumberField label="Quantity" defaultValue={2} min={0} max={10} size="sm" disabled />
    </div>
  )
}
