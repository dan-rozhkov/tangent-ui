"use client"

import { Treemap } from "@/components/ui/treemap"
import type { TreemapNode } from "@/components/ui/treemap"

const data: TreemapNode = {
  id: "all",
  label: "All regions",
  children: [
    {
      id: "na",
      label: "North America",
      children: [
        { id: "us", label: "United States", value: 18400, color: 24 },
        { id: "ca", label: "Canada", value: 2350, color: 19 },
        { id: "mx", label: "Mexico", value: 1240, color: 31 },
      ],
    },
    {
      id: "eu",
      label: "Europe",
      children: [
        { id: "de", label: "Germany", value: 4120, color: 28 },
        { id: "uk", label: "United Kingdom", value: 3860, color: 22 },
        { id: "fr", label: "France", value: 2710, color: 17 },
        { id: "es", label: "Spain", value: 1190, color: 35 },
      ],
    },
    {
      id: "apac",
      label: "Asia Pacific",
      children: [
        { id: "jp", label: "Japan", value: 3320, color: 12 },
        { id: "au", label: "Australia", value: 1980, color: 26 },
        { id: "sg", label: "Singapore", value: 1420, color: 41 },
        { id: "in", label: "India", value: 960, color: 58 },
      ],
    },
    {
      id: "latam",
      label: "Latin America",
      children: [
        { id: "br", label: "Brazil", value: 1650, color: 33 },
        { id: "ar", label: "Argentina", value: 520, color: 47 },
      ],
    },
  ],
}

export default function Demo() {
  return (
    <div className="w-full max-w-2xl">
      <Treemap
        data={data}
        label="ARR"
        colorLabel="Growth"
        formatColor={(value) => `+${value}%`}
        height={360}
      />
    </div>
  )
}
