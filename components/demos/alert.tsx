"use client"

import { useState } from "react"

import { Alert, type AlertTone } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const tones: AlertTone[] = ["info", "success", "warning", "danger"]

export default function Demo() {
  const [tone, setTone] = useState<AlertTone>("warning")
  const [open, setOpen] = useState(true)

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Alert tone={tone} title="Card expires soon" open={open} onDismiss={() => setOpen(false)}>
        Update your payment method before March 1 to avoid interruption.
      </Alert>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tones.map((next) => (
          <Button key={next} size="sm" variant={next === tone ? "primary" : "secondary"} onClick={() => setTone(next)}>
            {next}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  )
}
