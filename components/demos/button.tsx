"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

export default function Demo() {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button size="sm" variant="secondary">Small</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1600) }}>
          Save changes
        </Button>
        <Button variant="secondary" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }}>
          {copied ? <><CheckIcon className="size-4" />Copied to clipboard</> : <><CopyIcon className="size-4" />Copy</>}
        </Button>
      </div>
    </div>
  )
}
