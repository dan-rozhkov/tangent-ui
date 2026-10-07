"use client"

import { useEffect, useRef, useState } from "react"

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

/** How long the check or cross stays before the loader gathers back into its loop. */
const HOLD = 2000

export default function Demo() {
  const [variant, setVariant] = useState<MorphLoaderVariant>("dots")
  const [status, setStatus] = useState<MorphLoaderStatus>("loading")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function finish(next: Exclude<MorphLoaderStatus, "loading">) {
    window.clearTimeout(timer.current)
    setStatus(next)
    timer.current = window.setTimeout(() => setStatus("loading"), HOLD)
  }

  return (
    <div className="grid w-full max-w-sm justify-items-center gap-8">
      {/* Changing the shape while loading morphs the same four strokes into the new one. */}
      <MorphLoader variant={variant} status={status} size={72} successLabel="Published" errorLabel="Publish failed" className="text-accent" />
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
