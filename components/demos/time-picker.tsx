"use client"

import { useState } from "react"

import { TimePicker } from "@/components/ui/time-picker"

export default function Demo() {
  const [time, setTime] = useState("14:30")

  return (
    <div className="grid w-full max-w-xs gap-5">
      <TimePicker label="Start time" value={time} onChange={setTime} minuteStep={30} description="Meetings start on the half hour." />
      <TimePicker label="Reminder" defaultValue="18:15" format="24h" />
    </div>
  )
}
