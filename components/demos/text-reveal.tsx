"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { TextReveal } from "@/components/ui/text-reveal"

export default function Demo() {
  const [run, setRun] = useState(0)
  const dials = useDialKit(
    "Text reveal",
    {
      text: { type: "text", default: "Ship interfaces\nthat feel precise", placeholder: "Use \\n for a line break" },
      as: { type: "select", options: ["h1", "h2", "h3", "p"], default: "h1" },
      delay: [0.1, 0, 2, 0.05],
      replay: { type: "action", label: "Replay" },
    },
    { id: "text-reveal", onAction: () => setRun((value) => value + 1) },
  )

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Changing the key replays the entrance. */}
      <TextReveal
        key={run}
        as={dials.as as "h1" | "h2" | "h3" | "p"}
        className="text-4xl font-medium"
        text={dials.text.replace(/\\n/g, "\n")}
        delay={dials.delay}
      />
      <Button size="sm" variant="secondary" onClick={() => setRun((value) => value + 1)}>
        Replay
      </Button>
    </div>
  )
}
