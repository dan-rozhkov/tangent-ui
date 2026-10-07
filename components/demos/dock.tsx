"use client"

import { useState } from "react"
import { ChatCircleIcon, CircleIcon, ClipboardIcon, CursorIcon, DiamondIcon, HandIcon, SquareIcon, TextTIcon, TriangleIcon } from "@phosphor-icons/react"

import { Dock, type DockItem } from "@/components/ui/dock"

const initialItems: DockItem[] = [
  { id: "move", label: "Move", icon: <CursorIcon size={24} />, shortcut: "V" },
  { id: "hand", label: "Hand", icon: <HandIcon size={24} />, shortcut: "H" },
  {
    id: "shapes",
    label: "Shapes",
    icon: <SquareIcon size={24} />,
    items: [
      { id: "rect", label: "Rectangle", icon: <SquareIcon size={24} />, shortcut: "R" },
      { id: "ellipse", label: "Ellipse", icon: <CircleIcon size={24} />, shortcut: "O" },
      { id: "triangle", label: "Triangle", icon: <TriangleIcon size={24} />, shortcut: "Y" },
      { id: "diamond", label: "Diamond", icon: <DiamondIcon size={24} />, shortcut: "D" },
    ],
  },
  { id: "text", label: "Text", icon: <TextTIcon size={24} />, shortcut: "T" },
  { id: "sticky", label: "Sticky note", icon: <ClipboardIcon size={24} />, shortcut: "S" },
  { id: "comment", label: "Comment", icon: <ChatCircleIcon size={24} />, shortcut: "C", badge: 3 },
]

export default function Demo() {
  const [tool, setTool] = useState("move")
  const [items, setItems] = useState(initialItems)

  return (
    <div className="flex h-[420px] w-full max-w-[720px] flex-col items-center justify-between gap-4 pt-6 pb-10">
      <p className="text-center text-sm text-balance text-text-secondary">
        Drag a tool, or hold Alt with the arrow keys, to reorder. Comments clear their badge when opened.
      </p>
      <Dock
        label="Board tools"
        items={items}
        value={tool}
        onValueChange={(id) => {
          setTool(id)
          if (id === "comment") setItems((current) => current.map((item) => (item.id === "comment" ? { ...item, badge: 0 } : item)))
        }}
        onItemsChange={(next) => setItems(next)}
      />
    </div>
  )
}
