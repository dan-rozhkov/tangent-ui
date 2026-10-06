"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

const size = 48

export default function Demo() {
  const [sent, setSent] = useState(18)

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <Progress label="Uploading report.pdf" value={sent} max={size} showValue />
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setSent((value) => Math.max(0, value - 12))}>
          Back
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setSent((value) => Math.min(size, value + 12))}>
          Send more
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSent(0)}>
          Reset
        </Button>
      </div>
    </div>
  )
}
