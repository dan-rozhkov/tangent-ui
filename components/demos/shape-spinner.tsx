"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ShapeSpinner } from "@/components/ui/shape-spinner"
import type { ShapeSpinnerShape, ShapeSpinnerState } from "@/components/ui/shape-spinner"
import SegmentedControl from "@/components/ui/segmented-control"

const shapes = [
  { value: "pulse", label: "Pulse" },
  { value: "columns", label: "Columns" },
  { value: "orbit", label: "Orbit" },
  { value: "frame", label: "Frame" },
]

/** How long the check or cross stays before the spinner gathers back into its loop. */
const HOLD = 2000

export default function Demo() {
  const [shape, setShape] = useState<ShapeSpinnerShape>("pulse")
  const [state, setState] = useState<ShapeSpinnerState>("busy")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function settle(next: Exclude<ShapeSpinnerState, "busy">) {
    window.clearTimeout(timer.current)
    setState(next)
    timer.current = window.setTimeout(() => setState("busy"), HOLD)
  }

  return (
    <div className="grid w-full max-w-sm justify-items-center gap-8">
      {/* Changing the shape mid-loop regroups the same four strokes into the new one. */}
      <ShapeSpinner shape={shape} state={state} size={72} doneLabel="Backup complete" failedLabel="Backup failed" className="text-accent" />
      <div className="grid justify-items-center gap-3">
        <SegmentedControl label="Loop shape" options={shapes} value={shape} onValueChange={value => setShape(value as ShapeSpinnerShape)} />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => settle("done")}>
            Finish
          </Button>
          <Button size="sm" variant="ghost" onClick={() => settle("failed")}>
            Break
          </Button>
        </div>
      </div>
    </div>
  )
}
