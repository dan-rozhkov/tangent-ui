"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { AnimatedCounter } from "@/components/ui/animated-counter"
import { Button } from "@/components/ui/button"

export default function Demo() {
  const [amount, setAmount] = useState(48250)
  const dial = useDialKit(
    "Animated counter",
    {
      label: "Raised",
      prefix: "$",
      suffix: "",
      decimals: [0, 0, 3, 1],
      animateOnView: true,
    },
    { id: "animated-counter" }
  )

  return (
    <div className="grid justify-items-start gap-4">
      <AnimatedCounter
        label={dial.label}
        value={amount}
        prefix={dial.prefix}
        suffix={dial.suffix}
        decimals={dial.decimals}
        animateOnView={dial.animateOnView}
      />
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
