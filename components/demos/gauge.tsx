"use client"

import { useDialKit } from "dialkit"

import { Gauge, type GaugeProps } from "@/components/ui/gauge"

export default function Demo() {
  const props = useDialKit(
    "Gauge",
    {
      diskValue: [72, 0, 100, 1],
      storageValue: [38, 0, 100, 1],
      tone: { type: "select", options: ["accent", "success", "warning", "danger"], default: "accent" },
    },
    { id: "gauge" },
  )

  return (
    <div className="flex flex-wrap items-start justify-center gap-10">
      <Gauge
        label="Disk usage"
        value={props.diskValue}
        detail="360 of 500 GB"
        thresholds={[
          { from: 0, tone: "success", label: "Healthy" },
          { from: 70, tone: "warning", label: "Filling up" },
          { from: 90, tone: "danger", label: "Critical" },
        ]}
      />
      <Gauge label="Storage" value={props.storageValue} detail="190 of 500 GB" tone={props.tone as GaugeProps["tone"]} />
    </div>
  )
}
