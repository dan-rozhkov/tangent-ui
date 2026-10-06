"use client"

import { useState } from "react"

import { Select } from "@/components/ui/select"

const regions = [
  { value: "us", label: "United States" },
  { value: "eu", label: "Europe" },
  { value: "ap", label: "Asia Pacific", disabled: true },
  { value: "sa", label: "South America" },
]

export default function Demo() {
  const [region, setRegion] = useState("eu")

  return (
    <div className="grid w-full max-w-xs gap-5">
      <Select label="Region" value={region} onValueChange={setRegion} options={regions} description="Where your data is stored." />
      <Select
        label="Plan"
        placeholder="Choose a plan"
        options={[
          { value: "free", label: "Free" },
          { value: "pro", label: "Pro" },
          { value: "team", label: "Team" },
        ]}
      />
      <Select label="Workspace" defaultValue="arc" disabled options={[{ value: "arc", label: "Tangent" }]} />
    </div>
  )
}
