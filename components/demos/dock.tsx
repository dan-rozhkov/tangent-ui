"use client"

import { useState } from "react"
import { Circle, Diamond, Hand, MessageCircle, MousePointer2, Square, StickyNote, Triangle, Type } from "lucide-react"

import { Dock, type DockItem } from "@/components/ui/dock"

const initialItems: DockItem[] = [
  { id: "move", label: "Move", icon: <MousePointer2 />, shortcut: "V" },
  { id: "hand", label: "Hand", icon: <Hand />, shortcut: "H" },
  {
    id: "shapes",
    label: "Shapes",
    icon: <Square />,
    items: [
      { id: "rect", label: "Rectangle", icon: <Square />, shortcut: "R" },
      { id: "ellipse", label: "Ellipse", icon: <Circle />, shortcut: "O" },
      { id: "triangle", label: "Triangle", icon: <Triangle />, shortcut: "Y" },
      { id: "diamond", label: "Diamond", icon: <Diamond />, shortcut: "D" },
    ],
  },
  { id: "text", label: "Text", icon: <Type />, shortcut: "T" },
  { id: "sticky", label: "Sticky note", icon: <StickyNote />, shortcut: "S" },
  { id: "comment", label: "Comment", icon: <MessageCircle />, shortcut: "C", badge: 3 },
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
