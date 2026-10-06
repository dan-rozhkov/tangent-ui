"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"

/* Targets are fixed spans after mount, not build time, so the server and client agree on what is left. */
export default function Demo() {
  const [launch] = useState(() => Date.now() + (2 * 24 * 3600 + 4 * 3600 + 12 * 60 + 30) * 1000)
  const [soon, setSoon] = useState(() => Date.now() + 8_000)
  const [round, setRound] = useState(0)

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <Countdown target={launch} label="Keynote starts in" />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Countdown key={round} variant="compact" target={soon} units={["minutes", "seconds"]} label="Doors open in" completeLabel="Live now" />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setSoon(Date.now() + 8_000)
            setRound((value) => value + 1)
          }}
        >
          Restart
        </Button>
      </div>
    </div>
  )
}
