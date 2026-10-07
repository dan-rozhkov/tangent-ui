"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { TextReveal } from "@/components/ui/text-reveal"

export default function Demo() {
  const [run, setRun] = useState(0)

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Changing the key replays the entrance. */}
      <TextReveal key={run} as="h1" className="text-4xl font-medium" text={"Ship interfaces\nthat feel precise"} delay={0.1} />
      <Button size="sm" variant="secondary" onClick={() => setRun((value) => value + 1)}>
        Replay
      </Button>
    </div>
  )
}
