"use client"

import { useState } from "react"

import { TimeWheel } from "@/components/ui/time-wheel"
import type { TimeWheelMode } from "@/components/ui/time-wheel"
import SegmentedControl from "@/components/ui/segmented-control"

/* Fixed dates keep the prerendered reels and the hydrated ones identical. Real pages pass today after mount. */
const TODAY = new Date(2026, 8, 24)
const START = new Date(2026, 8, 25, 14, 15)
const DUE = new Date(2026, 9, 12)

const modes = [
  { value: "datetime", label: "Both" },
  { value: "date", label: "Day only" },
  { value: "time", label: "Clock only" },
]

/** Pretends to store the reminder, so the button shows pending and then success. */
const remember = () => new Promise<void>(resolve => setTimeout(resolve, 900))

export default function Demo() {
  const [mode, setMode] = useState<TimeWheelMode>("datetime")

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-5">
      <SegmentedControl label="Wheels" options={modes} value={mode} onValueChange={next => setMode(next as TimeWheelMode)} />
      <TimeWheel
        key={mode}
        className="max-w-[32.5rem]"
        mode={mode}
        heading={mode === "date" ? "Library book due" : "Remind me to call the plumber"}
        today={TODAY}
        defaultValue={mode === "date" ? DUE : START}
        shortcuts={mode === "date" ? false : undefined}
        onCommit={remember}
        copy={mode === "date" ? { commit: "Mark due", committed: "Marked" } : { commit: "Remind me", committing: "Setting", committed: "Reminder set" }}
      />
    </div>
  )
}
