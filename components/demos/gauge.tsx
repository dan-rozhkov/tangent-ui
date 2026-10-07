"use client"

import { Gauge } from "@/components/ui/gauge"

export default function Demo() {
  return (
    <div className="flex flex-wrap items-start justify-center gap-10">
      <Gauge
        label="Disk usage"
        value={72}
        detail="360 of 500 GB"
        thresholds={[
          { from: 0, tone: "success", label: "Healthy" },
          { from: 70, tone: "warning", label: "Filling up" },
          { from: 90, tone: "danger", label: "Critical" },
        ]}
      />
      <Gauge label="Storage" value={38} detail="190 of 500 GB" />
    </div>
  )
}
