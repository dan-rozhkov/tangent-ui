"use client"

import { useState } from "react"
import { useDialKit } from "dialkit"

import { Button } from "@/components/ui/button"
import { HoldToConfirm } from "@/components/ui/hold-to-confirm"

export default function Demo() {
  const [confirmed, setConfirmed] = useState(false)
  const [holding, setHolding] = useState(false)
  const props = useDialKit(
    "Hold to confirm",
    {
      label: { type: "text", default: "Hold to delete project" },
      confirmedLabel: { type: "text", default: "Deleted" },
      duration: [1500, 300, 4000, 50],
      tone: { type: "select", options: ["danger", "accent", "neutral"], default: "danger" },
    },
    { id: "hold-to-confirm" },
  )

  return (
    <div className="grid justify-items-center gap-3">
      <HoldToConfirm
        label={props.label}
        confirmedLabel={props.confirmedLabel}
        duration={props.duration}
        tone={props.tone as "accent" | "danger" | "neutral"}
        confirmed={confirmed}
        onConfirm={() => setConfirmed(true)}
        onHoldChange={setHolding}
      />
      <div className="grid min-h-control-sm place-items-center">
        {confirmed ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmed(false)}>
            Undo
          </Button>
        ) : (
          <p className="m-0 text-sm text-text-secondary" aria-hidden="true">
            {holding ? "Keep holding" : "Press and hold"}
          </p>
        )}
      </div>
    </div>
  )
}
