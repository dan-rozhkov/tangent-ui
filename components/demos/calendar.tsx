"use client"

import { useState } from "react"

import { Calendar } from "@/components/ui/calendar"

/* Fixed dates keep server and client markup identical. */
const initial = new Date(2026, 9, 14)
const earliest = new Date(2026, 9, 6)

export default function Demo() {
  const [date, setDate] = useState<Date | undefined>(initial)

  return (
    <Calendar
      value={date}
      onChange={setDate}
      minDate={earliest}
      disabledDates={(day) => day.getDay() === 0}
      showToday
    />
  )
}
