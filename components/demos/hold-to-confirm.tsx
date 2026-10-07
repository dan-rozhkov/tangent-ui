"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { HoldToConfirm } from "@/components/ui/hold-to-confirm"

export default function Demo() {
  const [confirmed, setConfirmed] = useState(false)
  const [holding, setHolding] = useState(false)

  return (
    <div className="grid justify-items-center gap-3">
      <HoldToConfirm
        label="Hold to delete project"
        confirmedLabel="Deleted"
        duration={1500}
        tone="danger"
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
