"use client"

import { useState } from "react"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DateRange } from "@/components/ui/date-range-picker"

/* Fixed dates keep server and client markup identical. */
const latest = new Date(2026, 11, 31)

export default function Demo() {
  const [range, setRange] = useState<DateRange | null>({ start: new Date(2026, 8, 21), end: new Date(2026, 9, 4) })

  return <DateRangePicker label="Report period" value={range} onChange={setRange} weekStartsOn={1} maxDate={latest} />
}
