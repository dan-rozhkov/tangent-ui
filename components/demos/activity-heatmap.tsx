"use client"

import { useState } from "react"

import {
  ActivityHeatmap,
  type ActivityDay,
} from "@/components/ui/activity-heatmap"

const DAY = 86_400_000

/** One year of fixed sample activity: busy weekdays, quiet weekends, a few dry spells. No randomness, so the server and the client render the same grid. */
function makeDays(): ActivityDay[] {
  const start = Date.UTC(2025, 9, 1)
  return Array.from({ length: 365 }, (_, index) => {
    const time = start + index * DAY
    const weekday = new Date(time).getUTCDay()
    const wave = Math.sin(index * 0.21) + Math.cos(index * 0.057 + 1.3)
    const base = weekday === 0 || weekday === 6 ? 1 : 5
    const dry = index % 53 < 5
    const count = dry
      ? 0
      : Math.max(0, Math.round(base + wave * 3 + (index % 7) * 0.4 - 1))
    return { date: new Date(time).toISOString().slice(0, 10), count }
  })
}

const days = makeDays()

export default function Demo() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="w-full max-w-3xl">
      <ActivityHeatmap
        days={days}
        label="Contributions, Oct 2025 to Sep 2026"
        period="the last year"
        selectedDate={selected}
        onSelectDate={setSelected}
      />
    </div>
  )
}
