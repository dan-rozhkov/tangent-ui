"use client"

import { useState } from "react"

import { LineChart, type LineChartDatum } from "@/components/ui/line-chart"
import SegmentedControl from "@/components/ui/segmented-control"

const DAY = 86_400_000
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const axisFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** Fixed sample data: waves instead of random numbers, so the server and the client render the same chart. */
function makeData(days: number): LineChartDatum[] {
  const end = Date.UTC(2026, 8, 30)
  return Array.from({ length: days }, (_, index) => {
    const time = end - (days - 1 - index) * DAY
    const signups = Math.round(
      140 +
        index * (days > 14 ? 1.4 : 4) +
        28 * Math.sin(index * 0.9) +
        14 * Math.cos(index * 0.37)
    )
    const previous = Math.round(
      112 +
        index * (days > 14 ? 1.1 : 3) +
        22 * Math.sin(index * 0.7 + 1) +
        10 * Math.cos(index * 0.5)
    )
    return {
      key: new Date(time).toISOString().slice(0, 10),
      label: dateFormat.format(time),
      axisLabel: axisFormat.format(time),
      values: { signups, previous },
    }
  })
}

const ranges = { "7d": makeData(7), "30d": makeData(30) }

export default function Demo() {
  const [range, setRange] = useState<"7d" | "30d">("30d")
  const [active, setActive] = useState<LineChartDatum | null>(null)
  const data = ranges[range]
  const shown = active ?? data[data.length - 1]

  return (
    <div className="grid w-full max-w-xl gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <span className="text-sm text-text-secondary">{shown.label}</span>
          <span className="font-display text-3xl font-medium tabular-nums">
            {shown.values.signups}
          </span>
        </div>
        <SegmentedControl
          label="Range"
          value={range}
          onValueChange={(value) => setRange(value as "7d" | "30d")}
          options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
          ]}
        />
      </div>
      <LineChart
        label="Signups"
        data={data}
        series={[
          { key: "signups", label: "This period" },
          { key: "previous", label: "Previous period", dashed: true },
        ]}
        onActiveChange={(_, datum) => setActive(datum)}
      />
    </div>
  )
}
