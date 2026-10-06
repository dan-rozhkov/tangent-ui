"use client"

import { useState } from "react"
import { Archive, Bold, Copy, Italic, Underline } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"

export default function Demo() {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Moving between neighbours inside the skip window opens the next tooltip at once, with a fade only. */}
      <div className="flex gap-1">
        <Tooltip content="Bold">
          <Button variant="ghost" size="sm" aria-label="Bold">
            <Bold size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip content="Italic">
          <Button variant="ghost" size="sm" aria-label="Italic">
            <Italic size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip content="Underline">
          <Button variant="ghost" size="sm" aria-label="Underline">
            <Underline size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>

      <Tooltip content="Archive" side="bottom">
        <Button variant="secondary" size="sm" aria-label="Archive">
          <Archive size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>

      {/* String content crossfades and the bubble springs to the new size. */}
      <Tooltip content={copied ? "Copied to clipboard" : "Copy link"}>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Copy link"
          onClick={() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }}
        >
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
    </div>
  )
}
