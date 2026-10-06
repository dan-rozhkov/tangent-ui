"use client"

import { useState } from "react"

import { DatePicker } from "@/components/ui/date-picker"

/* Fixed dates keep server and client markup identical. */
const earliest = new Date(2026, 9, 6)

export default function Demo() {
  const [start, setStart] = useState<Date | undefined>(new Date(2026, 9, 14))

  return (
    <div className="w-full max-w-xs">
      <DatePicker
        label="Start date"
        value={start}
        onChange={setStart}
        minDate={earliest}
        description="The first day the plan is active."
        showToday
      />
    </div>
  )
}
