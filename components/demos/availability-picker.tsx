"use client"

import { useMemo } from "react"

import { AvailabilityPicker, type AvailabilityAttendee, type AvailabilityDay } from "@/components/ui/availability-picker"
import { addDays, useToday } from "@/lib/date"

const attendees: AvailabilityAttendee[] = [
  { id: "maya", name: "Maya Chen" },
  { id: "leo", name: "Leo Okafor" },
  { id: "ines", name: "Ines Duarte" },
]

/** [hour, minute, busy ids] per slot, one row per day. */
const plan: [number, number, string[]?][][] = [
  [[9, 30], [10, 0, ["leo"]], [11, 30], [14, 0, ["maya", "leo", "ines"]]],
  [[10, 0], [10, 30, ["ines"]], [13, 0, ["leo", "ines"]], [15, 30], [16, 0]],
  [[9, 0, ["maya", "leo", "ines"]], [11, 0, ["maya"]], [14, 30]],
  [[10, 30], [11, 0, ["leo"]], [15, 0, ["maya", "ines"]], [16, 30]],
  [[9, 30, ["maya", "leo", "ines"]], [13, 30, ["leo"]], [14, 0, ["maya"]]],
]

function buildDays(today: Date): AvailabilityDay[] {
  const result: AvailabilityDay[] = []
  for (let offset = 0; result.length < plan.length; offset++) {
    const date = addDays(today, offset)
    if (date.getDay() === 0 || date.getDay() === 6) continue
    const row = plan[result.length]
    result.push({ date, slots: row.map(([h, m, busy]) => ({ start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m), busy })) })
  }
  return result
}

export default function Demo() {
  const today = useToday()
  const days = useMemo(() => (today ? buildDays(today) : null), [today])
  return (
    <div className="w-full max-w-[560px]">
      {days ? (
        <AvailabilityPicker title="Design review" duration={30} timeZoneLabel="Zürich time" attendees={attendees} days={days} />
      ) : (
        <div className="h-[28rem] rounded-surface border border-border bg-surface" />
      )}
    </div>
  )
}
