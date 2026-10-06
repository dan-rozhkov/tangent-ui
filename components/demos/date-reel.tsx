"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { DateReel } from "@/components/ui/date-reel"
import type { DateReelMode } from "@/components/ui/date-reel"
import SegmentedControl from "@/components/ui/segmented-control"

/* Fixed dates keep the prerendered reels and the hydrated ones identical. Real pages pass today after mount. */
const TODAY = new Date(2026, 8, 24)
const START = new Date(2026, 8, 25, 9, 0)
const BIRTHDAY = new Date(1994, 2, 14)

const modes = [
  { value: "datetime", label: "Date and time" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
]

/** Pretends to schedule the send, so the button shows pending and then success. */
const schedule = () => new Promise<void>(resolve => setTimeout(resolve, 900))

export default function Demo() {
  const [mode, setMode] = useState<DateReelMode>("datetime")
  const [run, setRun] = useState(0)
  const dials = useDialKit(
    "Date reel",
    {
      minuteStep: { type: "select", options: ["1", "5", "10", "15", "30"], default: "5" },
      hourCycle: { type: "select", options: ["12", "24"], default: "12" },
      speed: [1, 0.25, 3, 0.05],
      intro: true,
      paused: false,
      replay: { type: "action", label: "Replay intro" },
    },
    { id: "date-reel", onAction: () => setRun(n => n + 1) },
  )

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-5">
      <SegmentedControl label="Reels" options={modes} value={mode} onValueChange={next => setMode(next as DateReelMode)} />
      <DateReel
        key={`${mode}-${run}-${dials.minuteStep}`}
        className="max-w-[32.5rem]"
        mode={mode}
        minuteStep={Number(dials.minuteStep) as 1 | 5 | 10 | 15 | 30}
        hourCycle={dials.hourCycle === "24" ? 24 : 12}
        speed={dials.speed}
        intro={dials.intro}
        paused={dials.paused}
        title={mode === "date" ? "Birthday" : "Send later"}
        today={TODAY}
        defaultValue={mode === "date" ? BIRTHDAY : START}
        presets={mode === "date" ? false : undefined}
        onConfirm={schedule}
        labels={mode === "date" ? { confirm: "Save", confirmed: "Saved" } : { confirm: "Schedule", confirming: "Scheduling", confirmed: "Scheduled" }}
      />
    </div>
  )
}
