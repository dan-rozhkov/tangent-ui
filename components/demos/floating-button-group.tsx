"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUUpRightIcon, ArrowUUpLeftIcon, ChatCircleIcon, CursorIcon, ImageIcon, LinkIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PlayIcon, SquareIcon, TextTIcon } from "@phosphor-icons/react"

import { FloatingButtonGroup } from "@/components/ui/floating-button-group"

export default function Demo() {
  const [history, setHistory] = useState({ past: 2, future: 0 })
  const [copied, setCopied] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const copyTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const copyLink = () => {
    setCopied(true)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <FloatingButtonGroup
        label="Board actions"
        variant="floating"
        items={[
          {
            id: "undo",
            label: "Undo",
            icon: <ArrowUUpLeftIcon size={24} />,
            iconOnly: true,
            shortcut: "⌘Z",
            disabled: history.past === 0,
            onSelect: () => setHistory(h => ({ past: h.past - 1, future: h.future + 1 })),
          },
          {
            id: "redo",
            label: "Redo",
            icon: <ArrowUUpRightIcon size={24} />,
            iconOnly: true,
            shortcut: "⇧⌘Z",
            disabled: history.future === 0,
            onSelect: () => setHistory(h => ({ past: h.past + 1, future: h.future - 1 })),
          },
          { type: "separator" },
          { id: "comment", label: "Comment", icon: <ChatCircleIcon size={24} />, shortcut: "C" },
          { id: "share", label: copied ? "Copied" : "Share", reserveLabels: ["Share", "Copied"], icon: <LinkIcon size={24} />, onSelect: copyLink },
          { type: "separator" },
          {
            id: "present",
            label: presenting ? "Stop" : "Present",
            reserveLabels: ["Present", "Stop"],
            icon: <PlayIcon size={24} />,
            pressed: presenting,
            onSelect: () => setPresenting(p => !p),
          },
        ]}
      />
      {/* A vertical tools rail with zoom and insert actions. */}
      <FloatingButtonGroup
        label="Tools"
        orientation="vertical"
        size="sm"
        iconOnly
        items={[
          { id: "select", label: "Select", icon: <CursorIcon size={24} />, shortcut: "V" },
          { id: "shape", label: "Shape", icon: <SquareIcon size={24} />, shortcut: "R" },
          { id: "text", label: "Text", icon: <TextTIcon size={24} />, shortcut: "T" },
          { id: "image", label: "Image", icon: <ImageIcon size={24} /> },
          { type: "separator" },
          { id: "zoom-in", label: "Zoom in", icon: <MagnifyingGlassPlusIcon size={24} />, shortcut: "⌘+" },
          { id: "zoom-out", label: "Zoom out", icon: <MagnifyingGlassMinusIcon size={24} />, shortcut: "⌘−" },
        ]}
      />
    </div>
  )
}
