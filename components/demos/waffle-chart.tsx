"use client"

import { WaffleChart } from "@/components/ui/waffle-chart"

const mix = [
  { key: "wind-solar", label: "Wind and solar", value: 218 },
  { key: "hydro", label: "Hydro", value: 20 },
  { key: "gas", label: "Gas", value: 76 },
  { key: "coal", label: "Coal", value: 132 },
  { key: "other", label: "Other", value: 61 },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <WaffleChart data={mix} label="Electricity generation, 2023" unit="TWh" />
    </div>
  )
}
