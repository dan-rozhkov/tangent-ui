"use client"

import { useEffect, useRef, useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { MorphLoader } from "@/components/ui/morph-loader"
import type { MorphLoaderStatus, MorphLoaderVariant } from "@/components/ui/morph-loader"
import SegmentedControl from "@/components/ui/segmented-control"

const variants = [
  { value: "dots", label: "Dots" },
  { value: "bars", label: "Bars" },
  { value: "ring", label: "Ring" },
  { value: "square", label: "Square" },
]

export default function Demo() {
  const dial = useDialKit(
    "Morph loader",
    {
      size: [72, 16, 160, 1],
      strokeWidth: [2.5, 1, 4, 0.1],
      tone: true,
      decorative: false,
      // Seconds the check or cross stays before the loader gathers back into its loop.
      hold: [2, 0.5, 5, 0.1],
      succeed: { type: "action", label: "Succeed" },
      fail: { type: "action", label: "Fail" },
    },
    { id: "morph-loader", onAction: action => finish(action === "succeed" ? "success" : "error") },
  )
  const [variant, setVariant] = useState<MorphLoaderVariant>("dots")
  const [status, setStatus] = useState<MorphLoaderStatus>("loading")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function finish(next: Exclude<MorphLoaderStatus, "loading">) {
    window.clearTimeout(timer.current)
    setStatus(next)
    timer.current = window.setTimeout(() => setStatus("loading"), dial.hold * 1000)
  }

  return (
    <div className="grid w-full max-w-sm justify-items-center gap-8">
      {/* Changing the shape while loading morphs the same four strokes into the new one. */}
      <MorphLoader variant={variant} status={status} size={dial.size} strokeWidth={dial.strokeWidth} tone={dial.tone} decorative={dial.decorative} successLabel="Published" errorLabel="Publish failed" className="text-accent" />
      <div className="grid justify-items-center gap-3">
        <SegmentedControl label="Shape" options={variants} value={variant} onValueChange={value => setVariant(value as MorphLoaderVariant)} />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => finish("success")}>
            Succeed
          </Button>
          <Button size="sm" variant="ghost" onClick={() => finish("error")}>
            Fail
          </Button>
        </div>
      </div>
    </div>
  )
}
