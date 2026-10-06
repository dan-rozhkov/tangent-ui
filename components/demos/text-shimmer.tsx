"use client"

import { useEffect, useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { TextShimmer } from "@/components/ui/text-shimmer"

export default function Demo() {
  const [busy, setBusy] = useState(true)
  const dials = useDialKit(
    "Text shimmer",
    {
      duration: [1.8, 0.4, 5, 0.1],
      active: true,
      as: { type: "select", options: ["span", "p", "div", "h2", "h3", "h4"], default: "span" },
    },
    { id: "text-shimmer" },
  )

  // Work finishes on its own a few seconds in, so the shimmer settles to solid text.
  useEffect(() => {
    if (!busy) return
    const timer = window.setTimeout(() => setBusy(false), 5000)
    return () => window.clearTimeout(timer)
  }, [busy])

  return (
    <div className="flex flex-col items-center gap-6">
      <TextShimmer className="text-lg font-medium" active={busy && dials.active} duration={dials.duration} as={dials.as as "span" | "p" | "div" | "h2" | "h3" | "h4"}>
        {busy ? "Generating summary" : "Summary ready"}
      </TextShimmer>
      <Button size="sm" variant="secondary" onClick={() => setBusy((value) => !value)}>
        {busy ? "Stop" : "Run again"}
      </Button>
    </div>
  )
}
