"use client"

import { SlopeChart } from "@/components/ui/slope-chart"

const channels = [
  { key: "email", label: "Email", start: 3.1, end: 4.6 },
  { key: "search", label: "Organic search", start: 3.4, end: 3.6 },
  { key: "referral", label: "Referral", start: 2.6, end: 2.9 },
  { key: "direct", label: "Direct", start: 2.2, end: 2.4 },
  { key: "social", label: "Paid social", start: 1.9, end: 1.3 },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <SlopeChart
        data={channels}
        label="Conversion by channel"
        startLabel="Q1"
        endLabel="Q2"
        highlightKey="email"
        formatValue={(value) => `${value.toFixed(1)}%`}
      />
    </div>
  )
}
