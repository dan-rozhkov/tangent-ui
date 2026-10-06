"use client"

import { useState } from "react"

import { Combobox } from "@/components/ui/combobox"

const timezones = [
  { value: "utc", label: "UTC" },
  { value: "cet", label: "Central European", keywords: ["zurich", "berlin"] },
  { value: "pst", label: "Pacific", keywords: ["san francisco"] },
]

export default function Demo() {
  const [zone, setZone] = useState("")

  return (
    <div className="w-full max-w-80">
      <Combobox label="Time zone" options={timezones} value={zone} onValueChange={setZone} />
    </div>
  )
}
