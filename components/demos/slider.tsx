"use client"

import { useState } from "react"
import { VolumeHigh, VolumeLow } from "@mynaui/icons-react"

import { Slider } from "@/components/ui/slider"

export default function Demo() {
  const [range, setRange] = useState<[number, number]>([20, 80])
  const [volume, setVolume] = useState(60)

  return (
    <div className="grid w-full max-w-sm gap-8">
      <Slider
        label="Price"
        value={range}
        onValueChange={setRange}
        step={5}
        format={(v) => `$${v}`}
        thumbLabels={["Minimum price", "Maximum price"]}
      />
      <Slider
        label="Volume"
        value={volume}
        onValueChange={setVolume}
        format={(v) => `${v}%`}
        start={<VolumeLow size={16} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />}
        end={<VolumeHigh size={16} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />}
      />
      <Slider
        label="Quality"
        defaultValue={2}
        min={0}
        max={4}
        step={1}
        showValue={false}
        marks={[
          { value: 0, label: "Low" },
          { value: 1 },
          { value: 2, label: "Medium" },
          { value: 3 },
          { value: 4, label: "High" },
        ]}
      />
    </div>
  )
}
