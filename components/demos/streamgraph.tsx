"use client"

import { Streamgraph } from "@/components/ui/streamgraph"

const series = [
  { key: "bugs", label: "Bugs" },
  { key: "billing", label: "Billing" },
  { key: "onboarding", label: "Onboarding" },
  { key: "integrations", label: "Integrations" },
]

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const WEEK = 7 * 24 * 60 * 60 * 1000
const START = Date.UTC(2025, 0, 6)

/** Smooth, deterministic weekly volumes: each topic is a slow wave with its own phase. */
const data = Array.from({ length: 26 }, (_, week) => {
  const date = new Date(START + week * WEEK)
  const month = MONTHS[date.getUTCMonth()]
  const wave = (base: number, amp: number, phase: number, period: number) =>
    Math.round(base + amp * Math.sin((week + phase) / period))
  return {
    key: date.toISOString().slice(0, 10),
    label: `Week of ${month} ${date.getUTCDate()}`,
    axisLabel: date.getUTCDate() <= 7 ? month : undefined,
    values: {
      bugs: wave(46, 16, 0, 3.4),
      billing: wave(30, 11, 4, 4.2),
      onboarding: wave(22, 9, 8, 2.9),
      integrations: wave(16, 7, 12, 3.8),
    },
  }
})

export default function Demo() {
  return (
    <div className="w-full max-w-2xl">
      <Streamgraph
        data={data}
        series={series}
        label="Support tickets by topic"
        unit="tickets"
        categoryLabel="Week"
      />
    </div>
  )
}
