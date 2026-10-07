"use client"

import { useEffect, useRef, useState } from "react"
import { AlignLeft, AlignRight, Archive, Check, Copy, InboxUp, Link, Minus, Pin, Plus, TextAlignCenter, Trash } from "@mynaui/icons-react"

import { ButtonGroup } from "@/components/ui/button-group"

function useFlash(ms = 1800) {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const flash = () => {
    setOn(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), ms)
  }
  return [on, flash] as const
}

export default function Demo() {
  const [copied, flashCopied] = useFlash()
  const [duplicated, flashDuplicated] = useFlash()
  const [archived, setArchived] = useState(false)
  const [zoom, setZoom] = useState(100)

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ButtonGroup
        label="Document actions"
        items={[
          {
            id: "share",
            label: copied ? "Copied" : "Share",
            reserve: ["Share", "Copied"],
            icon: copied ? <Check /> : <Link />,
            onSelect: flashCopied,
          },
          {
            id: "duplicate",
            label: duplicated ? "Duplicated" : "Duplicate",
            reserve: ["Duplicate", "Duplicated"],
            icon: duplicated ? <Check /> : <Copy />,
            onSelect: flashDuplicated,
          },
          {
            id: "archive",
            label: archived ? "Restore" : "Archive",
            reserve: ["Archive", "Restore"],
            icon: archived ? <InboxUp /> : <Archive />,
            onSelect: () => setArchived(value => !value),
          },
        ]}
        menu={{
          label: "More actions",
          items: [
            { id: "pin", label: "Pin to sidebar", icon: <Pin /> },
            { id: "delete", label: "Delete", icon: <Trash />, destructive: true },
          ],
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <ButtonGroup
          label="Zoom"
          variant="solid"
          size="sm"
          items={[
            { id: "out", label: "Zoom out", icon: <Minus />, iconOnly: true, disabled: zoom <= 50, onSelect: () => setZoom(value => Math.max(50, value - 25)) },
            { id: "value", label: `Zoom ${zoom}%`, content: `${zoom}%`, onSelect: () => setZoom(100) },
            { id: "in", label: "Zoom in", icon: <Plus />, iconOnly: true, disabled: zoom >= 200, onSelect: () => setZoom(value => Math.min(200, value + 25)) },
          ]}
        />
        <ButtonGroup
          label="Text alignment"
          size="sm"
          items={[
            { id: "left", label: "Align left", icon: <AlignLeft />, iconOnly: true },
            { id: "center", label: "Align center", icon: <TextAlignCenter />, iconOnly: true },
            { id: "right", label: "Align right", icon: <AlignRight />, iconOnly: true },
          ]}
        />
        <ButtonGroup
          label="Disabled actions"
          size="sm"
          disabled
          items={[
            { id: "a", label: "Edit" },
            { id: "b", label: "Review" },
          ]}
        />
      </div>
      <ButtonGroup
        label="Sections"
        orientation="vertical"
        items={[
          { id: "overview", label: "Overview" },
          { id: "activity", label: "Activity" },
          { id: "settings", label: "Settings" },
        ]}
        menu={{
          label: "More sections",
          items: [
            { id: "billing", label: "Billing" },
            { id: "members", label: "Members", disabled: true },
          ],
        }}
      />
    </div>
  )
}
