"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, CopyIcon, DownloadSimpleIcon, FileTextIcon, LinkIcon, TrashIcon } from "@phosphor-icons/react"

import { SplitButton } from "@/components/ui/split-button"

export default function Demo() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function copy() {
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <SplitButton
        label="Publish"
        onClick={() => undefined}
        actions={[
          { label: "Schedule" },
          { label: "Save as draft" },
          { label: "Discard", destructive: true },
        ]}
      />
      <SplitButton
        variant="secondary"
        label={copied ? "Copied" : "Copy page"}
        icon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        onClick={copy}
        actions={[
          { label: "Copy link", icon: <LinkIcon size={15} />, onSelect: copy },
          { label: "View as Markdown", icon: <FileTextIcon size={15} /> },
          { label: "Download PDF", icon: <DownloadSimpleIcon size={15} />, disabled: true },
          { label: "Delete page", icon: <TrashIcon size={15} />, destructive: true },
        ]}
      />
      <SplitButton label="Merge" disabled actions={[{ label: "Squash and merge" }]} />
    </div>
  )
}
