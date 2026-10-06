"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { TextShimmer } from "@/components/ui/text-shimmer"

export default function Demo() {
  const [busy, setBusy] = useState(true)

  // Work finishes on its own a few seconds in, so the shimmer settles to solid text.
  useEffect(() => {
    if (!busy) return
    const timer = window.setTimeout(() => setBusy(false), 5000)
    return () => window.clearTimeout(timer)
  }, [busy])

  return (
    <div className="flex flex-col items-center gap-6">
      <TextShimmer className="text-lg font-medium" active={busy}>
        {busy ? "Generating summary" : "Summary ready"}
      </TextShimmer>
      <Button size="sm" variant="secondary" onClick={() => setBusy((value) => !value)}>
        {busy ? "Stop" : "Run again"}
      </Button>
    </div>
  )
}
