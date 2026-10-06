"use client"

import { DonutChart } from "@/components/ui/donut-chart"

export default function Demo() {
  return (
    <div className="w-full max-w-xl">
      <DonutChart
        label="Visits by source"
        unit="visits"
        data={[
          { key: "search", label: "Search", value: 4210 },
          { key: "direct", label: "Direct", value: 2380 },
          { key: "social", label: "Social", value: 1190 },
          { key: "email", label: "Email", value: 640 },
          { key: "ads", label: "Ads", value: 120 },
          { key: "other", label: "Referral", value: 90 },
        ]}
      />
    </div>
  )
}
