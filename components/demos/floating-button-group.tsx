"use client"

import { useEffect, useRef, useState } from "react"
import { Image as ImageIcon, Link, Message, MousePointer, Play, Redo, SearchMinus, SearchPlus, Square, TypeText, Undo } from "@mynaui/icons-react"

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
            icon: <Undo />,
            iconOnly: true,
            shortcut: "⌘Z",
            disabled: history.past === 0,
            onSelect: () => setHistory(h => ({ past: h.past - 1, future: h.future + 1 })),
          },
          {
            id: "redo",
            label: "Redo",
            icon: <Redo />,
            iconOnly: true,
            shortcut: "⇧⌘Z",
            disabled: history.future === 0,
            onSelect: () => setHistory(h => ({ past: h.past + 1, future: h.future - 1 })),
          },
          { type: "separator" },
          { id: "comment", label: "Comment", icon: <Message />, shortcut: "C" },
          { id: "share", label: copied ? "Copied" : "Share", reserveLabels: ["Share", "Copied"], icon: <Link />, onSelect: copyLink },
          { type: "separator" },
          {
            id: "present",
            label: presenting ? "Stop" : "Present",
            reserveLabels: ["Present", "Stop"],
            icon: <Play />,
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
          { id: "select", label: "Select", icon: <MousePointer />, shortcut: "V" },
          { id: "shape", label: "Shape", icon: <Square />, shortcut: "R" },
          { id: "text", label: "Text", icon: <TypeText />, shortcut: "T" },
          { id: "image", label: "Image", icon: <ImageIcon /> },
          { type: "separator" },
          { id: "zoom-in", label: "Zoom in", icon: <SearchPlus />, shortcut: "⌘+" },
          { id: "zoom-out", label: "Zoom out", icon: <SearchMinus />, shortcut: "⌘−" },
        ]}
      />
    </div>
  )
}
