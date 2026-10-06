"use client"

import { useState } from "react"

import { AnimatedCounter } from "@/components/ui/animated-counter"
import { Button } from "@/components/ui/button"

export default function Demo() {
  const [amount, setAmount] = useState(48250)

  return (
    <div className="grid justify-items-start gap-4">
      <AnimatedCounter label="Raised" value={amount} prefix="$" animateOnView />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAmount((value) => value + 1750)}
        >
          Add $1,750
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAmount((value) => Math.max(0, value - 1750))}
        >
          Remove $1,750
        </Button>
      </div>
    </div>
  )
}
