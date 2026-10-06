"use client"

import { useState } from "react"

import { BrushChart, type BrushChartDatum } from "@/components/ui/brush-chart"

const DAY = 86_400_000

/** Two years of fixed daily sample data: a slow climb, weekly and seasonal waves, and a step at the v2 launch. No randomness, so the server and the client render the same chart. */
function makeDays(): BrushChartDatum[] {
  const start = Date.UTC(2024, 9, 1)
  const launch = Date.UTC(2026, 2, 24)
  return Array.from({ length: 730 }, (_, index) => {
    const date = start + index * DAY
    const weekday = new Date(date).getUTCDay()
    const weekly = weekday === 0 || weekday === 6 ? -900 : 300
    const seasonal = 1400 * Math.sin(index / 58)
    const noise = 380 * Math.sin(index * 1.7) + 240 * Math.cos(index * 0.83)
    const boost = date >= launch ? 2600 : 0
    return {
      date,
      value: Math.round(9000 + index * 8 + seasonal + weekly + noise + boost),
    }
  })
}

const days = makeDays()

export default function Demo() {
  const [range, setRange] = useState<[number, number]>([
    days[days.length - 90].date as number,
    days[days.length - 1].date as number,
  ])

  return (
    <div className="w-full max-w-3xl">
      <BrushChart
        data={days}
        label="Daily active users"
        unit="users"
        range={range}
        onRangeChange={setRange}
        annotations={[
          {
            date: Date.UTC(2025, 5, 10),
            label: "v1.5",
            description: "Search and saved filters",
          },
          {
            date: Date.UTC(2026, 2, 24),
            label: "v2",
            description: "Offline mode and shared spaces",
          },
        ]}
      />
    </div>
  )
}
