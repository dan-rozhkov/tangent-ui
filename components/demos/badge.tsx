"use client"

import { useState } from "react"
import { CheckIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SpinnerArc } from "@/components/ui/icons"

const deploy = [
  { tone: "neutral", label: "Draft", icon: undefined },
  { tone: "info", label: "Building", icon: <SpinnerArc size={12} className="animate-spin motion-reduce:animate-none" /> },
  { tone: "success", label: "Live", icon: <CheckIcon size={12} /> },
  { tone: "danger", label: "Failed", icon: <XIcon size={12} /> },
] as const

export default function Demo() {
  const [step, setStep] = useState(0)
  const current = deploy[step]

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge>Neutral</Badge>
        <Badge tone="success" icon={<CheckIcon size={12} />}>Success</Badge>
        <Badge tone="info" icon={<InfoIcon size={12} />}>Info</Badge>
        <Badge tone="warning" icon={<WarningIcon size={12} />}>Warning</Badge>
        <Badge tone="danger">Danger</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge size="sm">Small</Badge>
        <Badge size="sm" tone="success">Paid</Badge>
        <Badge size="sm" tone="info">3 new</Badge>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={current.tone} icon={current.icon}>
          {current.label}
        </Badge>
        <Button size="sm" variant="secondary" onClick={() => setStep(value => (value + 1) % deploy.length)}>
          Next status
        </Button>
      </div>
    </div>
  )
}
