"use client"

import { MetricCard } from "@/components/ui/metric-card"

export default function Demo() {
  return (
    <div className="w-full max-w-xs">
      <MetricCard
        label="Uptime"
        value={99.9}
        suffix="%"
        context="Last 30 days"
        change="+0.2%"
      />
    </div>
  )
}
