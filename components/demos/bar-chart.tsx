"use client"

import { BarChart, type BarChartDatum } from "@/components/ui/bar-chart"

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const minutes = [32, 48, 27, 55, 41, 18, 63]
const initials = ["M", "T", "W", "T", "F", "S", "S"]

const week: BarChartDatum[] = minutes.map((value, index) => {
  const time = Date.UTC(2026, 8, 14 + index)
  return {
    key: new Date(time).toISOString().slice(0, 10),
    label: dayFormat.format(time),
    axisLabel: initials[index],
    value,
  }
})

export default function Demo() {
  return (
    <div className="w-full max-w-md">
      <BarChart
        data={week}
        label="Active minutes"
        period="Sep 14–20, 2026"
        unit="min"
      />
    </div>
  )
}
